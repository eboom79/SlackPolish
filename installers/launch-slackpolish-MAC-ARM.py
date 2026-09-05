#!/usr/bin/env python3
"""
SlackPolish runtime launcher for macOS ARM.

This launcher does not modify Slack.app. Instead it:
1. Starts Slack with a Chrome DevTools remote debugging port
2. Connects to Slack page targets over the DevTools protocol
3. Injects SlackPolish directly into Slack's page world

The launcher is intended to remain running while Slack is open.
"""

import argparse
import base64
import errno
import fcntl
import hashlib
import json
import os
import random
import re
import socket
import struct
import subprocess
import sys
import time
import http.server
import threading
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
BLUE = "\033[94m"
RESET = "\033[0m"

VERBOSE = False
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent
# Check if we're in a runtime directory or source directory
# Runtime: slack-*.js files are in SCRIPT_DIR itself
# Source: slack-*.js files are in SCRIPT_DIR (installers) parent
FILE_DIR = SCRIPT_DIR if (SCRIPT_DIR / "slack-config.js").exists() else REPO_ROOT
LOCK_PATH = Path("/tmp") / "slackpolish-mac-arm-launcher.lock"
STATE_DIR = Path.home() / "Library" / "Application Support" / "SlackPolish Runtime" / "mac-arm-runtime" / "state"
STATUS_PATH = STATE_DIR / "launcher-status.json"
LOG_PATH = STATE_DIR / "launcher.log"
ANSI_ESCAPE_RE = re.compile(r"\x1b\[[0-9;]*m")
LAUNCHER_SCRIPT_NAME = "launch-slackpolish-MAC-ARM.py"
_PYTHON_BASENAME_RE = re.compile(r"^[Pp]ython(\d+(\.\d+)*)?$")
_WRAPPER_BASENAMES = {"env", "sudo"}


def is_launcher_process_command(command_line):
    """Return True only if ``command_line`` is a Python interpreter *executing* this launcher.

    Used to find pre-lock ("legacy") launcher instances to replace. A plain
    substring test on the script name also matched unrelated processes that
    merely mention the file — an editor, ``grep``, ``git diff``, ``cmp`` — and
    killed them whenever SlackPolish.app was clicked.

    The script path may contain spaces (``~/Library/Application Support/...``)
    and ``ps`` joins argv with spaces, so path tokens are re-joined up to the
    first ``-``-prefixed option and must resolve to an existing file when more
    than one token is involved.
    """
    tokens = str(command_line or "").split()
    while tokens and os.path.basename(tokens[0]) in _WRAPPER_BASENAMES:
        tokens = tokens[1:]
    if not tokens:
        return False
    if os.path.basename(tokens[0]) == LAUNCHER_SCRIPT_NAME:
        return True  # executed directly via its shebang
    if not _PYTHON_BASENAME_RE.match(os.path.basename(tokens[0])):
        return False
    rest = tokens[1:]
    index = 0
    while index < len(rest) and rest[index].startswith("-"):
        if rest[index].startswith(("-c", "-m")):
            return False  # inline code / module run, not a script file
        index += 1
    path_tokens = []
    while index < len(rest) and not rest[index].startswith("-"):
        path_tokens.append(rest[index])
        index += 1
    if not path_tokens:
        return False
    script_path = " ".join(path_tokens)
    if os.path.basename(script_path) != LAUNCHER_SCRIPT_NAME:
        return False
    return len(path_tokens) == 1 or os.path.isfile(script_path)


# ---------------------------------------------------------------------------
# Local OpenAI proxy server
# ---------------------------------------------------------------------------

class SlackKeyResolver:
    """Reads and writes what SlackPolish keeps in Slack's localStorage - the OpenAI key and the user's
    settings (language, style, hotkey, personal style) - over the DevTools endpoint. This is the bridge
    that keeps the Chrome extension's own copy in step with Slack: a Save on either side is relayed once;
    nothing is looked up when a text is polished. Cached briefly in memory; never written to disk."""

    STORAGE_KEY = "slackpolish_openai_api_key"
    SETTINGS_KEY = "slackpolish_settings"
    # Settings fields that are Slack-only or secret and are therefore not shared
    PRIVATE_SETTINGS = ("apiKey",)
    # Fields both menus have; the only ones that travel between Slack and the extension
    SHARED_FIELDS = ("language", "style", "improveHotkey", "personalPolish")

    def __init__(self, debug_port, ttl=30.0, empty_ttl=3.0):
        self.debug_port = debug_port
        self.ttl = ttl
        self.empty_ttl = empty_ttl
        self._lock = threading.Lock()
        self._state = None
        self._expires = 0.0

    def invalidate(self):
        with self._lock:
            self._state = None

    def _current(self):
        now = time.monotonic()
        with self._lock:
            if self._state is not None and now < self._expires:
                return self._state
        state = {"key": "", "settings": {}}
        try:
            state = self._lookup()
        except Exception as error:
            print_verbose(f"Slack state lookup failed: {error}")
        with self._lock:
            self._state = state
            self._expires = time.monotonic() + (self.ttl if state.get("key") else self.empty_ttl)
        return state

    def get(self):
        """The OpenAI key saved in Slack ('' when none)."""
        return self._current().get("key", "")

    def get_settings(self):
        """The SlackPolish settings saved in Slack (dict, without secrets; {} when none)."""
        return dict(self._current().get("settings") or {})

    def shared_settings(self):
        """The subset of Slack's settings that the extension menu also has, plus the sync flag and Save time."""
        settings = self.get_settings()
        shared = {key: settings[key] for key in self.SHARED_FIELDS if key in settings}
        shared["syncWithChrome"] = settings.get("syncWithChrome") is True
        if settings.get("savedAt"):
            shared["savedAt"] = settings.get("savedAt")
        return shared

    def _slack_targets(self):
        with urllib.request.urlopen(f"http://127.0.0.1:{self.debug_port}/json/list", timeout=2) as response:
            targets = json.loads(response.read().decode("utf-8"))
        return [
            target for target in targets
            if target.get("type") == "page" and "app.slack.com" in (target.get("url") or "") and target.get("webSocketDebuggerUrl")
        ]

    def _evaluate_in_slack(self, expression):
        for target in self._slack_targets():
            session = SlackTargetSession(target)
            try:
                session.connect()
                reply = session.evaluate_expression(expression)
            finally:
                try:
                    session.close()
                except Exception:
                    pass
            result = (reply or {}).get("result", {}) if isinstance(reply, dict) else {}
            inner = result.get("result", result) if isinstance(result, dict) else {}
            value = inner.get("value") if isinstance(inner, dict) else None
            if value is not None:
                return value
        return None

    def _lookup(self):
        expression = (
            "JSON.stringify({ key: localStorage.getItem(" + json.dumps(self.STORAGE_KEY) + ") || '', "
            "settings: localStorage.getItem(" + json.dumps(self.SETTINGS_KEY) + ") || '' })"
        )
        value = self._evaluate_in_slack(expression)
        if not isinstance(value, str) or not value.strip():
            return {"key": "", "settings": {}}
        try:
            payload = json.loads(value)
        except ValueError:
            return {"key": "", "settings": {}}
        key = (payload.get("key") or "").strip() if isinstance(payload, dict) else ""
        settings = {}
        raw_settings = payload.get("settings") if isinstance(payload, dict) else None
        if isinstance(raw_settings, str) and raw_settings.strip():
            try:
                parsed = json.loads(raw_settings)
                if isinstance(parsed, dict):
                    settings = {k: v for k, v in parsed.items() if k not in self.PRIVATE_SETTINGS}
            except ValueError:
                settings = {}
        return {"key": key, "settings": settings}

    def write_settings(self, patch, api_key=None, saved_at=None):
        """A Save in the extension menu: merge the shared fields (and the key) into Slack's localStorage and
        tell the Slack scripts to reload, exactly as the Slack menu does. Returns (ok, error)."""
        shared = {k: v for k, v in (patch or {}).items() if k in self.SHARED_FIELDS}
        if shared and saved_at:
            shared["savedAt"] = saved_at
        if not shared and not api_key:
            return True, None
        key_statement = ""
        if api_key:
            key_statement = " localStorage.setItem(" + json.dumps(self.STORAGE_KEY) + ", " + json.dumps(api_key) + ");"
        expression = (
            "(() => { const key = " + json.dumps(self.SETTINGS_KEY) + ";"
            " let current = {}; try { current = JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch (e) { current = {}; }"
            " const next = Object.assign({}, current, " + json.dumps(shared) + ");"
            " localStorage.setItem(key, JSON.stringify(next));"
            + key_statement +
            " window.dispatchEvent(new CustomEvent('slackpolish-settings-updated', { detail: { settings: next, source: 'chrome-extension' } }));"
            " return 'ok'; })()"
        )
        try:
            value = self._evaluate_in_slack(expression)
        finally:
            self.invalidate()
        if value == "ok":
            return True, None
        if value is None:
            return False, "Slack page not found on the DevTools endpoint (is Slack running through SlackPolish?)"
        return False, f"Slack did not confirm the write: {str(value)[:200]}"


# ---------------------------------------------------------------------------
# Settings-sync WebSocket (launcher <-> Chrome extension)
# ---------------------------------------------------------------------------

WS_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
LAUNCHER_SYNC_PROTOCOL = 1


class WebSocketClosed(Exception):
    pass


def _ws_encode_text(text):
    """Server -> client text frame (unmasked)."""
    payload = text.encode("utf-8")
    length = len(payload)
    if length < 126:
        header = struct.pack("!BB", 0x81, length)
    elif length < (1 << 16):
        header = struct.pack("!BBH", 0x81, 126, length)
    else:
        header = struct.pack("!BBQ", 0x81, 127, length)
    return header + payload


def _ws_read_frame(stream):
    """Client -> server frame from a buffered stream. Returns (opcode, payload); raises WebSocketClosed on EOF."""
    def read_exact(count):
        data = b""
        while len(data) < count:
            chunk = stream.read(count - len(data))
            if not chunk:
                raise WebSocketClosed()
            data += chunk
        return data

    header = read_exact(2)
    opcode = header[0] & 0x0F
    masked = (header[1] & 0x80) != 0
    length = header[1] & 0x7F
    if length == 126:
        length = struct.unpack("!H", read_exact(2))[0]
    elif length == 127:
        length = struct.unpack("!Q", read_exact(8))[0]
    mask = read_exact(4) if masked else b""
    payload = read_exact(length) if length else b""
    if masked:
        payload = bytes(payload[i] ^ mask[i % 4] for i in range(length))
    return opcode, payload


class SyncClient:
    """One connected extension (a service worker)."""

    def __init__(self, connection, origin):
        self.connection = connection
        self.origin = origin
        self._send_lock = threading.Lock()

    def send_raw(self, frame):
        with self._send_lock:
            self.connection.sendall(frame)

    def send_text(self, text):
        self.send_raw(_ws_encode_text(text))

    def send_json(self, message):
        self.send_text(json.dumps(message))


class SyncHub:
    """The connected extensions. Pings every ``ping_interval`` seconds, which also keeps the extension's
    service worker alive (Chrome extends its lifetime while WebSocket messages flow)."""

    def __init__(self, ping_interval=20.0):
        self._lock = threading.Lock()
        self._clients = []
        self.ping_interval = ping_interval
        thread = threading.Thread(target=self._ping_loop, daemon=True)
        thread.start()

    def add(self, client):
        with self._lock:
            self._clients.append(client)

    def remove(self, client):
        with self._lock:
            if client in self._clients:
                self._clients.remove(client)

    def count(self):
        with self._lock:
            return len(self._clients)

    def broadcast(self, message):
        text = json.dumps(message)
        delivered = 0
        with self._lock:
            clients = list(self._clients)
        for client in clients:
            try:
                client.send_text(text)
                delivered += 1
            except Exception:
                self.remove(client)
        return delivered

    def _ping_loop(self):
        while True:
            time.sleep(self.ping_interval)
            try:
                self.broadcast({"type": "ping"})
            except Exception:
                pass


def slack_state_for_extension(resolver):
    """What the extension receives on connect: Slack's shared settings and the saved key."""
    if resolver is None:
        return {"settings": {}, "apiKey": ""}
    try:
        return {"settings": resolver.shared_settings(), "apiKey": resolver.get()}
    except Exception as error:
        print_verbose(f"Could not read Slack state: {error}")
        return {"settings": {}, "apiKey": ""}


# ---------------------------------------------------------------------------
# Local OpenAI proxy server (+ settings sync)
# ---------------------------------------------------------------------------

class _OpenAIProxyHandler(http.server.BaseHTTPRequestHandler):
    """Minimal HTTP handler:
      POST /proxy/openai       - envelope proxy used by the Slack scripts (unchanged)
      POST /slackpolish/sync   - Slack saved its settings: relay to connected extensions (Slack origin only)
      GET  /slackpolish/sync   - WebSocket for the Chrome extension (extension origin only): hello with
                                 Slack's state, slack-saved relays, chrome-saved writes into Slack
    """

    def log_message(self, format, *args):  # suppress default access log noise
        pass

    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")

    def do_OPTIONS(self):
        self.send_response(200)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        if self.path == "/slackpolish/sync" and "websocket" in (self.headers.get("Upgrade", "") or "").lower():
            self._handle_sync_websocket()
            return
        self.send_response(404)
        self.end_headers()

    def do_POST(self):
        if self.path == "/slackpolish/sync":
            self._handle_slack_save()
            return
        if self.path != "/proxy/openai":
            self.send_response(404)
            self.end_headers()
            return

        try:
            length = int(self.headers.get("Content-Length", 0))
            raw = self.rfile.read(length)
            req = json.loads(raw)
        except Exception as e:
            self._respond(400, json.dumps({"error": f"Bad request: {e}"}))
            return

        url = req.get("url", "")
        method = req.get("method", "POST").upper()
        headers = req.get("headers", {})
        body = req.get("body", None)
        if isinstance(body, str):
            body = body.encode("utf-8")
        elif body is not None:
            body = json.dumps(body).encode("utf-8")

        try:
            upstream_req = urllib.request.Request(url, data=body, headers=headers, method=method)
            with urllib.request.urlopen(upstream_req, timeout=30) as resp:
                resp_body = resp.read().decode("utf-8", errors="replace")
                resp_headers = dict(resp.headers)
                self._respond(resp.status, json.dumps({
                    "status": resp.status,
                    "headers": resp_headers,
                    "body": resp_body,
                }))
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace")
            self._respond(502, json.dumps({
                "status": e.code,
                "headers": dict(e.headers),
                "body": err_body,
            }))
        except Exception as e:
            self._respond(502, json.dumps({"error": str(e)}))

    def _handle_slack_save(self):
        """The Slack settings menu was saved. Settings travel only when 'Sync settings with Chrome' is
        checked; the OpenAI key always (one key is valid for both). Accepted from the Slack origin only -
        a web page cannot forge the Origin header."""
        origin = self.headers.get("Origin", "") or ""
        if not origin.startswith("https://app.slack.com"):
            self._respond(401, json.dumps({"error": {"message": "Slack save notifications are accepted from Slack only"}}))
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(length) or b"{}")
        except Exception as e:
            self._respond(400, json.dumps({"error": {"message": f"Bad request: {e}"}}))
            return
        settings = body.get("settings") if isinstance(body.get("settings"), dict) else {}
        sync_on = settings.get("syncWithChrome") is True
        shared = {k: settings.get(k) for k in SlackKeyResolver.SHARED_FIELDS + ("syncWithChrome", "savedAt") if k in settings} if sync_on else None
        message = {
            "type": "slack-saved",
            "settings": shared,
            "syncWithChrome": sync_on,
            "apiKey": (body.get("apiKey") or "").strip() if isinstance(body.get("apiKey"), str) else "",
            "savedAt": settings.get("savedAt"),
        }
        resolver = getattr(self.server, "key_resolver", None)
        if resolver is not None:
            resolver.invalidate()
        hub = getattr(self.server, "sync_hub", None)
        delivered = hub.broadcast(message) if hub else 0
        self._respond(200, json.dumps({"ok": True, "delivered": delivered}))

    def _handle_sync_websocket(self):
        origin = self.headers.get("Origin", "") or ""
        if not origin.startswith("chrome-extension://"):
            self.send_response(403)
            self.end_headers()
            return
        key = self.headers.get("Sec-WebSocket-Key", "")
        if not key:
            self.send_response(400)
            self.end_headers()
            return
        accept = base64.b64encode(hashlib.sha1((key + WS_GUID).encode("ascii")).digest()).decode("ascii")
        # Written by hand: BaseHTTPRequestHandler speaks HTTP/1.0 and browsers reject a WebSocket
        # upgrade unless the status line is HTTP/1.1 (Chrome: "Invalid status line").
        self.wfile.write(
            b"HTTP/1.1 101 Switching Protocols\r\n"
            b"Upgrade: websocket\r\n"
            b"Connection: Upgrade\r\n"
            + f"Sec-WebSocket-Accept: {accept}\r\n".encode("ascii")
            + b"\r\n"
        )
        self.wfile.flush()
        self.close_connection = True  # this handler owns the socket until the extension goes away

        resolver = getattr(self.server, "key_resolver", None)
        hub = getattr(self.server, "sync_hub", None)
        client = SyncClient(self.connection, origin)
        try:
            self.connection.settimeout(None)
            # hello first, then join the hub: the extension must never see a ping before hello
            client.send_json({"type": "hello", "protocol": LAUNCHER_SYNC_PROTOCOL, "launcherVersion": "mac-arm", "slack": slack_state_for_extension(resolver)})
            if hub:
                hub.add(client)
            while True:
                opcode, payload = _ws_read_frame(self.rfile)
                if opcode == 0x8:
                    break
                if opcode == 0x9:  # ping -> pong
                    client.send_raw(struct.pack("!BB", 0x8A, len(payload)) + payload)
                    continue
                if opcode != 0x1:
                    continue
                try:
                    message = json.loads(payload.decode("utf-8"))
                except ValueError:
                    continue
                self._handle_sync_message(client, message, resolver)
        except (WebSocketClosed, ConnectionError, OSError):
            pass
        except Exception as error:
            print_verbose(f"Sync WebSocket error: {error}")
        finally:
            if hub:
                hub.remove(client)
            try:
                self.connection.close()
            except Exception:
                pass

    def _handle_sync_message(self, client, message, resolver):
        kind = message.get("type") if isinstance(message, dict) else None
        if kind == "pong":
            return
        if kind == "chrome-saved":
            # A Save in the extension menu: settings only when its sync box was checked (else null), key always
            ok, error = True, None
            if resolver is None:
                ok, error = False, "Slack is not connected"
            else:
                try:
                    ok, error = resolver.write_settings(message.get("settings") or {}, (message.get("apiKey") or "").strip() or None, saved_at=message.get("savedAt"))
                except Exception as exc:
                    ok, error = False, str(exc)
            client.send_json({"type": "chrome-saved-ack", "ok": ok, "error": error})

    def _respond(self, status, body_str):
        encoded = body_str.encode("utf-8")
        self.send_response(status)
        self._send_cors_headers()
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)


def start_openai_proxy(port, timeout=8.0, poll_interval=0.25, key_resolver=None, sync_ping_interval=20.0):
    """Start the OpenAI proxy / settings-sync HTTP server in a daemon thread. Returns the bound port.

    The proxy port is normally held by the previous launcher instance until it
    exits, so binding is retried for up to ``timeout`` seconds. Must be called
    only after the single-instance lock has been acquired (which terminates any
    previous launcher); otherwise the bind can never succeed.

    ``key_resolver`` (a SlackKeyResolver) is the bridge to Slack's saved settings and key for the
    Chrome extension's settings sync (WebSocket on /slackpolish/sync).
    """
    deadline = time.monotonic() + timeout
    while True:
        try:
            server = http.server.ThreadingHTTPServer(("127.0.0.1", port), _OpenAIProxyHandler)
            server.daemon_threads = True
            server.key_resolver = key_resolver
            server.sync_hub = SyncHub(ping_interval=sync_ping_interval)
            break
        except OSError as error:
            if error.errno not in (errno.EADDRINUSE, errno.EACCES) or time.monotonic() >= deadline:
                raise RuntimeError(
                    f"OpenAI proxy port {port} is still in use after {timeout:.0f}s "
                    f"(another SlackPolish launcher or process is holding it): {error}"
                ) from error
            time.sleep(poll_interval)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    return server.server_address[1]


def append_log_line(text):
    try:
        STATE_DIR.mkdir(parents=True, exist_ok=True)
        with open(LOG_PATH, "a", encoding="utf-8") as handle:
            handle.write(ANSI_ESCAPE_RE.sub("", text) + "\n")
    except Exception:
        pass


def print_header(text):
    line_one = f"\n{BLUE}=================================================="
    line_two = text
    line_three = f"=================================================={RESET}\n"
    print(line_one, flush=True)
    print(line_two, flush=True)
    print(line_three, flush=True)
    append_log_line(line_one)
    append_log_line(line_two)
    append_log_line(line_three)


def print_success(text):
    line = f"{GREEN}✅ {text}{RESET}"
    print(line, flush=True)
    append_log_line(line)


def print_warning(text):
    line = f"{YELLOW}⚠️ {text}{RESET}"
    print(line, flush=True)
    append_log_line(line)


def print_error(text):
    line = f"{RED}❌ {text}{RESET}"
    print(line, flush=True)
    append_log_line(line)


def print_info(text):
    line = f"{BLUE}🔍 {text}{RESET}"
    print(line, flush=True)
    append_log_line(line)


def print_verbose(text):
    if VERBOSE:
        line = f"{BLUE}🔍 [VERBOSE] {text}{RESET}"
        print(line, flush=True)
        append_log_line(line)


def normalize_slack_app_path(path):
    normalized = os.path.expanduser(path)
    if normalized.endswith("/Contents/MacOS/Slack"):
        return normalized
    if normalized.endswith(".app"):
        return os.path.join(normalized, "Contents", "MacOS", "Slack")
    return normalized


def find_slack_executable():
    candidates = [
        "/Applications/Slack.app/Contents/MacOS/Slack",
        str(Path.home() / "Applications" / "Slack.app" / "Contents" / "MacOS" / "Slack"),
    ]

    for candidate in candidates:
        if os.path.exists(candidate):
            return candidate
    return None


def build_runtime_payload():
    file_map = [
        ("slack-config.js", "config"),
        ("logo-data.js", "logo"),
        ("slack-text-improver.js", "text improver"),
        ("slack-settings.js", "settings"),
        ("slack-channel-summary.js", "channel summary"),
    ]

    missing = [name for name, _ in file_map if not (FILE_DIR / name).exists()]
    if missing:
        raise FileNotFoundError(f"Missing required SlackPolish files: {', '.join(missing)}")

    parts = []
    for path, label in file_map:
        with open(FILE_DIR / path, "r", encoding="utf-8") as handle:
            script = handle.read().strip()
        if not script.endswith(";"):
            script += ";"
        parts.append((label, script))

    wrapped_parts = []
    for label, script in parts:
        wrapped_parts.append(
            f"""
    try {{
// === SLACKPOLISH {label.upper()} START ===
{script}
// === SLACKPOLISH {label.upper()} END ===
    }} catch (error) {{
        console.error('SlackPolish {label} bootstrap failed:', error);
    }}
""".rstrip()
        )

    payload_hash = hashlib.sha256("".join(script for _, script in parts).encode("utf-8")).hexdigest()[:12]

    payload = f"""
(function() {{
    const href = String(window.location.href || '');
    if (!/^https:\\/\\/app\\.slack\\.com\\/client\\//.test(href)) {{
        return;
    }}

    const runtimeState = {{
        href,
        build: '{payload_hash}',
        activatedAt: Date.now()
    }};
    const previousRuntime = window.__SLACKPOLISH_RUNTIME_ACTIVE__ || null;
    window.__SLACKPOLISH_RUNTIME_ACTIVE__ = runtimeState;

    if (
        window.__SLACKPOLISH_RUNTIME_URL__ === href &&
        previousRuntime &&
        previousRuntime.build === runtimeState.build
    ) {{
        return;
    }}
    window.__SLACKPOLISH_RUNTIME_URL__ = href;

    console.log('SLACKPOLISH runtime bootstrap starting ' + href);
{os.linesep.join(wrapped_parts)}
    console.log('SLACKPOLISH runtime bootstrap completed ' + href);
}})();
""".strip()

    return payload


class DevToolsProtocolError(RuntimeError):
    pass


class AlreadyRunningAndFocused(RuntimeError):
    pass


class SimpleWebSocketClient:
    def __init__(self, websocket_url, headers=None):
        self.extra_headers = dict(headers or {})
        parsed = urllib.parse.urlparse(websocket_url)
        if parsed.scheme != "ws":
            raise ValueError(f"Unsupported WebSocket scheme: {parsed.scheme}")

        self.host = parsed.hostname or "127.0.0.1"
        self.port = parsed.port or 80
        self.path = parsed.path or "/"
        if parsed.query:
            self.path += "?" + parsed.query

        self.socket = None
        self.recv_buffer = b""
        self.message_id = 0

    def connect(self):
        self.socket = socket.create_connection((self.host, self.port), timeout=5)
        key = base64.b64encode(os.urandom(16)).decode("ascii")
        request = (
            f"GET {self.path} HTTP/1.1\r\n"
            f"Host: {self.host}:{self.port}\r\n"
            "Upgrade: websocket\r\n"
            "Connection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {key}\r\n"
            "Sec-WebSocket-Version: 13\r\n"
            + "".join(f"{name}: {value}\r\n" for name, value in self.extra_headers.items())
            + "\r\n"
        )
        self.socket.sendall(request.encode("ascii"))
        response = self._recv_http_headers()
        status_line = response.splitlines()[0] if response else ""
        if not status_line.startswith("HTTP/1.1 101"):
            raise DevToolsProtocolError(f"WebSocket handshake failed: {status_line}")

    def close(self):
        if self.socket:
            try:
                self.socket.close()
            finally:
                self.socket = None

    def send_command(self, method, params=None):
        self.message_id += 1
        payload = {
            "id": self.message_id,
            "method": method,
            "params": params or {},
        }
        self._send_text(json.dumps(payload))
        return self.message_id

    def wait_for_response(self, expected_id, timeout=5):
        deadline = time.time() + timeout
        while time.time() < deadline:
            message = self._recv_message(timeout=deadline - time.time())
            if not message:
                continue

            if "id" in message and message["id"] == expected_id:
                if "error" in message:
                    raise DevToolsProtocolError(json.dumps(message["error"]))
                return message.get("result", {})

        raise TimeoutError(f"Timed out waiting for DevTools response id={expected_id}")

    def _recv_http_headers(self):
        data = b""
        while b"\r\n\r\n" not in data:
            chunk = self.socket.recv(4096)
            if not chunk:
                break
            data += chunk
        return data.decode("utf-8", errors="replace")

    def _send_text(self, text):
        payload = text.encode("utf-8")
        mask_key = os.urandom(4)

        first_byte = 0x81
        length = len(payload)
        if length < 126:
            header = struct.pack("!BB", first_byte, 0x80 | length)
        elif length < (1 << 16):
            header = struct.pack("!BBH", first_byte, 0x80 | 126, length)
        else:
            header = struct.pack("!BBQ", first_byte, 0x80 | 127, length)

        masked = bytes(payload[i] ^ mask_key[i % 4] for i in range(length))
        self.socket.sendall(header + mask_key + masked)

    def _recv_exact(self, count):
        while len(self.recv_buffer) < count:
            chunk = self.socket.recv(4096)
            if not chunk:
                raise DevToolsProtocolError("WebSocket connection closed unexpectedly")
            self.recv_buffer += chunk

        data = self.recv_buffer[:count]
        self.recv_buffer = self.recv_buffer[count:]
        return data

    def _recv_message(self, timeout=5):
        self.socket.settimeout(timeout)
        header = self._recv_exact(2)
        first_byte, second_byte = header[0], header[1]
        opcode = first_byte & 0x0F
        masked = (second_byte & 0x80) != 0
        length = second_byte & 0x7F

        if length == 126:
            length = struct.unpack("!H", self._recv_exact(2))[0]
        elif length == 127:
            length = struct.unpack("!Q", self._recv_exact(8))[0]

        masking_key = self._recv_exact(4) if masked else b""
        payload = self._recv_exact(length)

        if masked:
            payload = bytes(payload[i] ^ masking_key[i % 4] for i in range(length))

        if opcode == 0x8:
            return None
        if opcode != 0x1:
            return None

        text = payload.decode("utf-8", errors="replace")
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            print_warning(f"Failed to decode DevTools message: {text[:200]}")
            return None


class SlackTargetSession:
    def __init__(self, target):
        self.target = target
        self.websocket_url = target["webSocketDebuggerUrl"]
        self.websocket = SimpleWebSocketClient(self.websocket_url)
        self.initialized = False

    def connect(self):
        self.websocket.connect()
        self._command("Runtime.enable")
        self._command("Page.enable")
        self.initialized = True

    def install_script(self, source):
        self._command("Page.addScriptToEvaluateOnNewDocument", {"source": source})

    def evaluate(self, source):
        return self._command(
            "Runtime.evaluate",
            {
                "expression": source,
                "awaitPromise": False,
                "returnByValue": True,
            },
        )

    def evaluate_expression(self, expression):
        return self._command(
            "Runtime.evaluate",
            {
                "expression": expression,
                "awaitPromise": False,
                "returnByValue": True,
            },
        )

    def close(self):
        self.websocket.close()

    def _command(self, method, params=None):
        command_id = self.websocket.send_command(method, params)
        return self.websocket.wait_for_response(command_id)


class SlackPolishMacLauncher:
    def __init__(
        self,
        slack_executable,
        slack_app_path,
        debug_port,
        launch_slack,
        relaunch,
        inject_interval,
        launch_mode,
        attach_or_relaunch=False,
    ):
        self.slack_executable = slack_executable
        self.slack_app_path = slack_app_path
        self.debug_port = debug_port
        self.launch_slack = launch_slack
        self.relaunch = relaunch
        self.inject_interval = inject_interval
        self.launch_mode = launch_mode
        self.attach_or_relaunch = attach_or_relaunch
        self.runtime_payload = build_runtime_payload()
        self.payload_hash = hashlib.sha256(self.runtime_payload.encode("utf-8")).hexdigest()[:12]
        self.proxy_port = debug_port + 1
        self.sessions = {}
        self.lock_handle = None
        self.last_heartbeat = 0
        self.devtools_failure_count = 0
        self.last_devtools_recovery = 0
        self.status = {
            "pid": os.getpid(),
            "started_at": int(time.time()),
            "last_heartbeat": int(time.time()),
            "phase": "starting",
            "debug_port": self.debug_port,
            "payload_hash": self.payload_hash,
            "launch_mode": self.launch_mode,
            "attach_or_relaunch": self.attach_or_relaunch,
            "relaunch": self.relaunch,
            "slack_executable": self.slack_executable,
            "last_error": None,
            "session_count": 0,
            "devtools_failure_count": 0,
            "last_devtools_recovery": None,
        }

    def run(self):
        print_header("🍎 SlackPolish Runtime Launcher for macOS ARM")
        print_success(f"Runtime payload prepared ({self.payload_hash})")
        self._acquire_or_recover_single_instance_lock()
        self._terminate_legacy_launchers()
        self._update_status(phase="lock-acquired")

        # The previous launcher (now terminated) held the proxy port; bind only
        # after the lock so "replace running launcher" actually works.
        self._update_status(phase="starting-openai-proxy")
        start_openai_proxy(self.proxy_port, key_resolver=SlackKeyResolver(self.debug_port))
        print_success(f"OpenAI proxy listening on 127.0.0.1:{self.proxy_port} (settings sync with the Chrome extension on /slackpolish/sync)")

        try:
            if self.relaunch:
                self._update_status(phase="relaunching-slack")
                self._quit_slack()

            if self.launch_slack:
                self._update_status(phase="launching-slack")
                self._launch_slack()

            self._update_status(phase="connecting-devtools")
            self._connect_or_relaunch_if_needed()

            print_info("Watching Slack page targets for workspace injection...")
            self._update_status(phase="watching-targets", last_error=None)
            while True:
                try:
                    self._poll_targets()
                    self._heartbeat()
                    time.sleep(self.inject_interval)
                except KeyboardInterrupt:
                    print_info("Stopping launcher...")
                    self._update_status(phase="stopped")
                    break
                except Exception as error:
                    if self._handle_target_poll_error(error):
                        continue
                    time.sleep(self.inject_interval)
        finally:
            self._close_sessions()
            self._update_status(phase="stopped", session_count=0)
            self._release_single_instance_lock()

    def _connect_or_relaunch_if_needed(self):
        print_info("Waiting for Slack DevTools endpoint...")
        initial_timeout = 2 if self.attach_or_relaunch else 20

        try:
            self._wait_for_devtools(timeout=initial_timeout)
            print_success(f"Connected to DevTools endpoint on port {self.debug_port}")
            return
        except TimeoutError:
            if not self.attach_or_relaunch:
                raise

            print_warning(
                "Slack DevTools endpoint was not detected quickly. "
                "Relaunching Slack with SlackPolish runtime enabled..."
            )

        self._quit_slack()
        self._launch_slack()

        print_info("Waiting for Slack DevTools endpoint after relaunch...")
        self._wait_for_devtools()
        print_success(f"Connected to DevTools endpoint on port {self.debug_port} after relaunch")

    def _acquire_single_instance_lock(self):
        LOCK_PATH.parent.mkdir(parents=True, exist_ok=True)
        self.lock_handle = open(LOCK_PATH, "a+", encoding="utf-8")
        try:
            fcntl.flock(self.lock_handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise RuntimeError("SlackPolish is already running")

        self.lock_handle.seek(0)
        self.lock_handle.truncate()
        self.lock_handle.write(str(os.getpid()))
        self.lock_handle.flush()

    def _acquire_or_recover_single_instance_lock(self):
        try:
            self._acquire_single_instance_lock()
            return
        except RuntimeError:
            lock_pid = self._read_lock_pid()
            # Always replace a running launcher so updated runtime code takes effect.
            if lock_pid and self._process_exists(lock_pid):
                self._terminate_process(lock_pid, reason="replaced by new launcher")
                time.sleep(1)
            self._acquire_single_instance_lock()
            print_warning("Replaced previous SlackPolish launcher process")

    def _release_single_instance_lock(self):
        if not self.lock_handle:
            return
        try:
            self.lock_handle.seek(0)
            self.lock_handle.truncate()
            fcntl.flock(self.lock_handle.fileno(), fcntl.LOCK_UN)
        finally:
            self.lock_handle.close()
            self.lock_handle = None

    def _read_lock_pid(self):
        try:
            return int(LOCK_PATH.read_text(encoding="utf-8").strip())
        except Exception:
            return None

    def _read_status(self):
        try:
            with open(STATUS_PATH, "r", encoding="utf-8") as handle:
                return json.load(handle)
        except Exception:
            return None

    def _write_status(self):
        try:
            STATE_DIR.mkdir(parents=True, exist_ok=True)
            with open(STATUS_PATH, "w", encoding="utf-8") as handle:
                json.dump(self.status, handle, indent=2, sort_keys=True)
        except Exception as error:
            print_verbose(f"Could not write launcher status: {error}")

    def _update_status(self, **updates):
        self.status.update(updates)
        self.status["pid"] = os.getpid()
        self.status["last_heartbeat"] = int(time.time())
        self.status["session_count"] = len(self.sessions)
        self._write_status()

    def _heartbeat(self):
        now = time.time()
        if now - self.last_heartbeat < 2:
            return
        self.last_heartbeat = now
        self._update_status()

    def _process_exists(self, pid):
        if not pid:
            return False
        try:
            os.kill(pid, 0)
            return True
        except OSError:
            return False

    def _can_recover_stuck_launcher(self, lock_pid, status):
        if not lock_pid or not self._process_exists(lock_pid):
            return False

        if not status or status.get("pid") != lock_pid:
            return False

        heartbeat_age = time.time() - float(status.get("last_heartbeat") or 0)
        if heartbeat_age < 15:
            return False

        try:
            self._fetch_json("/json/version")
            return False
        except Exception:
            return True

    def _terminate_process(self, pid, reason):
        if not pid or pid == os.getpid():
            return
        print_warning(f"Stopping {reason} process {pid}")
        try:
            os.kill(pid, 15)
        except OSError:
            return

    def _bring_slack_to_front(self):
        app_target = self.slack_app_path or "/Applications/Slack.app"
        commands = [
            ["open", "-a", app_target],
            ["osascript", "-e", 'tell application "Slack" to activate'],
            ["osascript", "-e", 'tell application id "com.tinyspeck.slackmacgap" to activate'],
        ]
        for command in commands:
            try:
                subprocess.run(
                    command,
                    check=False,
                    stdout=subprocess.DEVNULL,
                    stderr=subprocess.DEVNULL,
                )
            except Exception as error:
                print_verbose(
                    "Could not run foreground command "
                    + " ".join(command)
                    + f": {error}"
                )

    def _terminate_legacy_launchers(self):
        try:
            result = subprocess.run(
                ["ps", "-ax", "-o", "pid=", "-o", "command="],
                check=True,
                capture_output=True,
                text=True,
            )
        except Exception as error:
            print_verbose(f"Could not scan for duplicate launchers: {error}")
            return

        for raw_line in result.stdout.splitlines():
            parts = raw_line.strip().split(None, 1)
            if len(parts) != 2:
                continue
            try:
                pid = int(parts[0])
            except ValueError:
                continue
            if pid == os.getpid():
                continue
            if not is_launcher_process_command(parts[1]):
                continue
            self._terminate_process(pid, reason="legacy duplicate launcher")

    def _quit_slack(self):
        # Ask Slack to quit gracefully via AppleScript so it can flush localStorage.
        result = subprocess.run(
            ["osascript", "-e", 'tell application "Slack" to quit'],
            check=False,
            capture_output=True,
        )
        if result.returncode != 0:
            # Slack wasn't running or AppleScript failed — fall back to signal.
            subprocess.run(["pkill", "-x", "Slack"], check=False)
        print_info("Requested Slack shutdown before launch")
        # Give Slack up to 5 s to write its data and exit cleanly.
        for _ in range(10):
            time.sleep(0.5)
            check = subprocess.run(["pgrep", "-x", "Slack"], capture_output=True)
            if check.returncode != 0:
                break
        else:
            # Still alive after 5 s — force kill.
            subprocess.run(["pkill", "-9", "-x", "Slack"], check=False)
            time.sleep(0.5)

    def _launch_slack(self):
        debug_args = [
            f"--remote-debugging-port={self.debug_port}",
            "--remote-allow-origins=*",
        ]

        if self.launch_mode == "open":
            app_target = self.slack_app_path or "/Applications/Slack.app"
            command = ["open", "-a", app_target, "--args", *debug_args]
        else:
            command = [self.slack_executable, *debug_args]

        print_info("Launching Slack with remote debugging enabled...")
        print_verbose("Launch command: " + " ".join(command))
        subprocess.Popen(command, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    def _wait_for_devtools(self, timeout=20):
        deadline = time.time() + timeout
        while time.time() < deadline:
            try:
                self._fetch_json("/json/version")
                return
            except Exception:
                time.sleep(0.5)
        self._diagnose_devtools_unavailable()
        raise TimeoutError("Slack DevTools endpoint did not become available")

    def _diagnose_devtools_unavailable(self):
        """Print a helpful message when the DevTools endpoint does not open."""
        slack_exe = self.slack_executable or ""
        slack_app = slack_exe.split("/Contents/MacOS/Slack")[0] if "/Contents/MacOS/Slack" in slack_exe else None
        if not slack_app:
            slack_app = "/Applications/Slack.app"

        fw = os.path.join(
            slack_app,
            "Contents", "Frameworks",
            "Electron Framework.framework",
            "Electron Framework",
        )
        if not os.path.exists(fw):
            return

        try:
            with open(fw, "rb") as handle:
                data = handle.read()
        except Exception:
            return

        sentinel = b"dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX"
        idx = data.find(sentinel)
        if idx == -1:
            return

        fuse_start = idx + len(sentinel)
        version = data[fuse_start]
        count = data[fuse_start + 1]
        # Fuse index 3 is EnableNodeCliInspectArguments
        if count > 3:
            cli_inspect_fuse = data[fuse_start + 2 + 3]
            if cli_inspect_fuse != 0x31:
                patcher = os.path.join(os.path.dirname(__file__), "patch-electron-fuse-MAC-ARM.py")
                print_error(
                    "Slack's Electron binary has the EnableNodeCliInspectArguments fuse "
                    "disabled. This prevents --remote-debugging-port from working."
                )
                print_error(
                    "Fix: run the SlackPolish installer again, or patch manually:"
                )
                print_error(f"  python3 {patcher}")

    def _poll_targets(self):
        targets = self._fetch_json("/json/list")
        self.devtools_failure_count = 0
        current_keys = set()

        for target in targets:
            if target.get("type") != "page":
                continue

            target_url = str(target.get("url") or "")
            if "app.slack.com" not in target_url:
                continue

            websocket_url = target.get("webSocketDebuggerUrl")
            if not websocket_url:
                continue

            current_keys.add(websocket_url)
            if websocket_url in self.sessions:
                self._refresh_target(target, websocket_url)
                continue

            self._attach_target(target)

        stale = [key for key in self.sessions if key not in current_keys]
        for key in stale:
            self.sessions[key].close()
            del self.sessions[key]
        self._update_status(
            phase="watching-targets",
            last_error=None,
            devtools_failure_count=self.devtools_failure_count,
        )

    def _handle_target_poll_error(self, error):
        print_warning(f"Target polling error: {error}")

        if self._devtools_available():
            self.devtools_failure_count = 0
            self._update_status(
                phase="poll-error",
                last_error=str(error),
                devtools_failure_count=self.devtools_failure_count,
            )
            return False

        self.devtools_failure_count += 1
        self._update_status(
            phase="poll-error",
            last_error=str(error),
            devtools_failure_count=self.devtools_failure_count,
        )

        if self.devtools_failure_count < 3:
            return False

        if not (self.attach_or_relaunch or self.launch_slack or self.relaunch):
            print_warning(
                "Slack DevTools endpoint is unavailable. Attach-only mode will keep waiting."
            )
            return False

        now = time.time()
        if now - self.last_devtools_recovery < 15:
            return False

        self.last_devtools_recovery = now
        self._recover_lost_devtools_endpoint()
        return True

    def _recover_lost_devtools_endpoint(self):
        print_warning(
            "Slack DevTools endpoint appears to be gone. "
            "Relaunching Slack with SlackPolish runtime enabled..."
        )
        self._close_sessions()
        self._update_status(
            phase="recovering-devtools",
            last_error=None,
            session_count=0,
            last_devtools_recovery=int(self.last_devtools_recovery),
        )

        if self.attach_or_relaunch:
            self._connect_or_relaunch_if_needed()
        else:
            self._quit_slack()
            self._launch_slack()
            print_info("Waiting for Slack DevTools endpoint after recovery relaunch...")
            self._wait_for_devtools()
            print_success(
                f"Connected to DevTools endpoint on port {self.debug_port} after recovery relaunch"
            )

        self.devtools_failure_count = 0
        self._update_status(
            phase="watching-targets",
            last_error=None,
            devtools_failure_count=self.devtools_failure_count,
        )

    def _close_sessions(self):
        for session in self.sessions.values():
            try:
                session.close()
            except Exception:
                pass
        self.sessions.clear()

    def _refresh_target(self, target, websocket_url):
        session = self.sessions.get(websocket_url)
        if not session:
            return

        session.target = target

        try:
            if self._target_needs_runtime_reinject(session):
                print_warning(
                    "SlackPolish runtime was missing from target. Re-injecting: "
                    + f"{target.get('title') or '(untitled)'} | {target.get('url')}"
                )
                proxy_init = f"window.__SLACKPOLISH_PROXY_PORT__ = {self.proxy_port};"
                session.install_script(proxy_init)
                session.evaluate(proxy_init)
                session.install_script(self.runtime_payload)
                session.evaluate(self.runtime_payload)
                print_success(
                    "Re-injected SlackPolish into target: "
                    + f"{target.get('title') or '(untitled)'} | {target.get('url')}"
                )
        except Exception as error:
            print_warning(f"Target session became unhealthy, reattaching: {error}")
            try:
                session.close()
            finally:
                del self.sessions[websocket_url]
            self._attach_target(target)

    def _attach_target(self, target):
        session = SlackTargetSession(target)
        session.connect()
        proxy_init = f"window.__SLACKPOLISH_PROXY_PORT__ = {self.proxy_port};"
        session.install_script(proxy_init)
        session.evaluate(proxy_init)
        session.install_script(self.runtime_payload)
        session.evaluate(self.runtime_payload)
        self.sessions[session.websocket_url] = session
        print_success(
            "Attached to Slack target: "
            + f"{target.get('title') or '(untitled)'} | {target.get('url')}"
        )

    def _target_needs_runtime_reinject(self, session):
        result = session.evaluate_expression(
            """
(() => {
    const href = String(window.location.href || '');
    const runtime = window.__SLACKPOLISH_RUNTIME_ACTIVE__;
    const badge = document.getElementById('slackpolish-runtime-status');
    return {
        href,
        hasRuntime: !!runtime,
        hasBadge: !!badge,
        runtimeHref: runtime && runtime.href ? String(runtime.href) : null
    };
})()
""".strip()
        )
        value = result.get("result", {}).get("value") or {}

        href = str(value.get("href") or "")
        has_runtime = bool(value.get("hasRuntime"))
        has_badge = bool(value.get("hasBadge"))
        runtime_href = str(value.get("runtimeHref") or "")

        if not href.startswith("https://app.slack.com/client/"):
            return False

        return not has_runtime or not has_badge or runtime_href != href

    def _fetch_json(self, path):
        url = f"http://127.0.0.1:{self.debug_port}{path}"
        with urllib.request.urlopen(url, timeout=3) as response:
            return json.load(response)

    def _devtools_available(self):
        try:
            self._fetch_json("/json/version")
            return True
        except Exception:
            return False


def parse_args():
    parser = argparse.ArgumentParser(
        description="Launch SlackPolish on macOS without modifying Slack.app"
    )
    parser.add_argument(
        "--slack-path",
        help="Path to Slack.app or Slack executable",
    )
    parser.add_argument(
        "--debug-port",
        type=int,
        default=9222,
        help="Chrome DevTools port to use for Slack runtime injection",
    )
    parser.add_argument(
        "--attach-only",
        action="store_true",
        help="Do not launch Slack, only attach to an already-running Slack debug port",
    )
    parser.add_argument(
        "--attach-or-relaunch",
        action="store_true",
        help="Attach to running Slack when possible, otherwise relaunch Slack with the debug port",
    )
    parser.add_argument(
        "--relaunch",
        action="store_true",
        help="Quit Slack before launching it with the debug port",
    )
    parser.add_argument(
        "--poll-interval",
        type=float,
        default=1.0,
        help="Seconds between target polling cycles",
    )
    parser.add_argument(
        "-v",
        "--verbose",
        action="store_true",
        help="Enable verbose logging",
    )
    parser.add_argument(
        "--launch-mode",
        choices=["open", "exec"],
        default="open",
        help="How to launch Slack on macOS",
    )
    return parser.parse_args()


def main():
    global VERBOSE
    args = parse_args()
    VERBOSE = args.verbose
    append_log_line("")
    append_log_line(f"=== launcher start {time.strftime('%Y-%m-%d %H:%M:%S')} pid={os.getpid()} ===")

    slack_executable = normalize_slack_app_path(args.slack_path) if args.slack_path else find_slack_executable()
    slack_app_path = None
    if slack_executable and "/Contents/MacOS/Slack" in slack_executable:
        slack_app_path = slack_executable.split("/Contents/MacOS/Slack")[0]

    if not slack_executable and not args.attach_only:
        print_error("Could not find Slack executable")
        return 1

    if slack_executable and not os.path.exists(slack_executable):
        print_error(f"Slack executable not found: {slack_executable}")
        return 1

    launcher = SlackPolishMacLauncher(
        slack_executable=slack_executable,
        slack_app_path=slack_app_path,
        debug_port=args.debug_port,
        launch_slack=not (args.attach_only or args.attach_or_relaunch),
        relaunch=args.relaunch,
        inject_interval=args.poll_interval,
        launch_mode=args.launch_mode,
        attach_or_relaunch=args.attach_or_relaunch,
    )

    try:
        launcher.run()
        return 0
    except AlreadyRunningAndFocused:
        return 0
    except KeyboardInterrupt:
        return 0
    except Exception as error:
        print_error(str(error))
        return 1


if __name__ == "__main__":
    sys.exit(main())
