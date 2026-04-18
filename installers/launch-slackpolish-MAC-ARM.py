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


class SimpleWebSocketClient:
    def __init__(self, websocket_url):
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
            "\r\n"
        )
        self.socket.sendall(request.encode("ascii"))
        response = self._recv_http_headers()
        if "101" not in response.splitlines()[0]:
            raise DevToolsProtocolError(f"WebSocket handshake failed: {response.splitlines()[0]}")

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
        self.sessions = {}
        self.lock_handle = None
        self.last_heartbeat = 0
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
        }

    def run(self):
        print_header("🍎 SlackPolish Runtime Launcher for macOS ARM")
        print_success(f"Runtime payload prepared ({self.payload_hash})")
        self._acquire_or_recover_single_instance_lock()
        self._terminate_legacy_launchers()
        self._update_status(phase="lock-acquired")

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
                    print_warning(f"Target polling error: {error}")
                    self._update_status(phase="poll-error", last_error=str(error))
                    time.sleep(self.inject_interval)
        finally:
            for session in self.sessions.values():
                session.close()
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
            status = self._read_status()
            lock_pid = self._read_lock_pid()
            if self._can_recover_stuck_launcher(lock_pid, status):
                self._terminate_process(lock_pid, reason="stale launcher")
                time.sleep(1)
                self._acquire_single_instance_lock()
                print_warning("Recovered from a stale SlackPolish launcher process")
                return

            self._bring_slack_to_front()
            raise RuntimeError(f"SlackPolish is already running. Logs: {LOG_PATH}")

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
        try:
            subprocess.run(
                ["open", "-a", app_target],
                check=False,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
        except Exception as error:
            print_verbose(f"Could not bring Slack to the foreground: {error}")

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
            line = raw_line.strip()
            if "launch-slackpolish-MAC-ARM.py" not in line:
                continue
            parts = line.split(None, 1)
            if len(parts) != 2:
                continue
            try:
                pid = int(parts[0])
            except ValueError:
                continue
            if pid == os.getpid():
                continue
            self._terminate_process(pid, reason="legacy duplicate launcher")

    def _quit_slack(self):
        subprocess.run(["pkill", "-x", "Slack"], check=False)
        print_info("Requested Slack shutdown before launch")
        time.sleep(1)

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
        raise TimeoutError("Slack DevTools endpoint did not become available")

    def _poll_targets(self):
        targets = self._fetch_json("/json/list")
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
                continue

            self._attach_target(target)

        stale = [key for key in self.sessions if key not in current_keys]
        for key in stale:
            self.sessions[key].close()
            del self.sessions[key]
        self._update_status(phase="watching-targets", last_error=None)

    def _attach_target(self, target):
        session = SlackTargetSession(target)
        session.connect()
        session.install_script(self.runtime_payload)
        session.evaluate(self.runtime_payload)
        self.sessions[session.websocket_url] = session
        print_success(
            "Attached to Slack target: "
            + f"{target.get('title') or '(untitled)'} | {target.get('url')}"
        )

    def _fetch_json(self, path):
        url = f"http://127.0.0.1:{self.debug_port}{path}"
        with urllib.request.urlopen(url, timeout=3) as response:
            return json.load(response)


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
    except KeyboardInterrupt:
        return 0
    except Exception as error:
        print_error(str(error))
        return 1


if __name__ == "__main__":
    sys.exit(main())
