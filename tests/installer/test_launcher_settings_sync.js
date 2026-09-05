#!/usr/bin/env node

/**
 * Installer Test: the launcher relays settings between SlackPolish in Slack and the Chrome extension
 *
 * - the extension connects over a WebSocket (extension origin only) and receives Slack's shared settings + key
 * - a Save in Slack (POST /slackpolish/sync, Slack origin only) is relayed: settings only when "Sync settings
 *   with Chrome" is checked, the key always
 * - a Save in the extension (chrome-saved) is written into Slack's localStorage and the Slack scripts are told
 * - the launcher pings clients (keeps the extension worker alive); the legacy /proxy/openai envelope still works
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const launcherPath = path.join(__dirname, '../../installers/launch-slackpolish-MAC-ARM.py');
const source = fs.readFileSync(launcherPath, 'utf8');

let testsTotal = 0, testsPassed = 0;
function runTest(name, fn) {
    testsTotal++;
    try { console.log(`🧪 Testing: ${name}`); fn(); testsPassed++; console.log(`✅ PASSED: ${name}`); }
    catch (e) { console.log(`❌ FAILED: ${name}`); console.log(`   Error: ${e.message}`); }
}
function assert(c, m) { if (!c) throw new Error(m || 'Assertion failed'); }

console.log('🚀 Running Launcher Settings-Sync Tests');
console.log('=======================================\n');

runTest('Static: the bridge never persists the key; endpoints are origin-guarded; proxy is threaded', () => {
    assert(source.includes('start_openai_proxy(self.proxy_port, key_resolver=SlackKeyResolver(self.debug_port))'), 'run() wires the Slack bridge into the proxy');
    const resolver = source.slice(source.indexOf('class SlackKeyResolver'), source.indexOf('# Settings-sync WebSocket'));
    assert(!/(?<![A-Za-z_.])open\(|write_text|json\.dump\(|\.write\(/.test(resolver), 'resolver must not persist anything');
    assert(source.includes('if not origin.startswith("chrome-extension://"):') && source.includes('if not origin.startswith("https://app.slack.com"):'), 'WebSocket for the extension only, Slack saves from Slack only');
    assert(source.includes('http.server.ThreadingHTTPServer(') && source.includes('server.daemon_threads = True'), 'WebSocket handlers hold a connection each: the server must be threaded');
    assert(!source.includes('"/v1/chat/completions"') && !source.includes('"/slackpolish/settings"'), 'the per-polish endpoints are gone');
    assert(source.includes("window.dispatchEvent(new CustomEvent('slackpolish-settings-updated'"), 'a write into Slack tells the Slack scripts to reload (same event the Slack menu fires)');
    assert(source.includes('b"HTTP/1.1 101 Switching Protocols\\r\\n"') && source.includes('if not status_line.startswith("HTTP/1.1 101"):'), 'WebSocket handshake must be HTTP/1.1 (browsers reject HTTP/1.0 upgrades) and the client must check for it');
});

const harness = `
import importlib.util, json, threading, http.client, io, urllib.request, time
spec = importlib.util.spec_from_file_location("launcher", ${JSON.stringify(launcherPath)})
mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
out = {}

# --- resolver.write_settings builds the right expression (fake DevTools session records it) ---
evaluated = []
class FakeSession:
    def __init__(self, target): self.target = target
    def connect(self): pass
    def evaluate_expression(self, expression):
        evaluated.append(expression)
        if expression.startswith("JSON.stringify"):
            return {"result": {"result": {"type": "string", "value": json.dumps({"key": "sk-from-slack", "settings": json.dumps({"language": "HEBREW", "style": "CONCISE", "improveHotkey": "Ctrl+Alt", "personalPolish": "Use British spelling", "syncWithChrome": True, "savedAt": 1700000000000, "apiKey": "should-not-leak", "smartContext": {"enabled": True}})})}}}
        return {"result": {"result": {"type": "string", "value": "ok"}}}
    def close(self): pass
class FakeResp(io.BytesIO):
    status = 200; headers = {}
    def __enter__(self): return self
    def __exit__(self, *a): return False
upstream = []
def fake_urlopen(req, timeout=None):
    url = req.full_url if hasattr(req, "full_url") else str(req)
    if url.endswith("/json/list"):
        return FakeResp(json.dumps([{"type": "page", "url": "https://app.slack.com/client/T1/C1", "webSocketDebuggerUrl": "ws://127.0.0.1:1/slack"}, {"type": "page", "url": "https://other.example/", "webSocketDebuggerUrl": "ws://127.0.0.1:1/x"}]).encode())
    upstream.append({"url": url, "auth": req.get_header("Authorization")})
    return FakeResp(json.dumps({"choices": [{"message": {"content": "polished"}}]}).encode())
urllib.request.urlopen = fake_urlopen
mod.SlackTargetSession = FakeSession

resolver = mod.SlackKeyResolver(9222, ttl=30)
out["shared"] = resolver.shared_settings()
out["key"] = resolver.get()
ok, err = resolver.write_settings({"style": "GRAMMAR", "improveHotkey": "Ctrl+Shift", "smartContext": {"enabled": False}}, "sk-from-chrome", saved_at=1700000001000)
out["write"] = {"ok": ok, "err": err, "expression": evaluated[-1]}

# --- live server: WebSocket hello, Slack save relay, chrome-saved write, ping, legacy proxy ---
port = mod.start_openai_proxy(0, timeout=2.0, key_resolver=resolver, sync_ping_interval=0.4)
ext_origin = "chrome-extension://abcdefghijklmnopabcdefghijklmnop"
import socket as _socket
raw = _socket.create_connection(("127.0.0.1", port), timeout=5)
raw.sendall((f"GET /slackpolish/sync HTTP/1.1\\r\\nHost: 127.0.0.1:{port}\\r\\nUpgrade: websocket\\r\\nConnection: Upgrade\\r\\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\\r\\nSec-WebSocket-Version: 13\\r\\nOrigin: {ext_origin}\\r\\n\\r\\n").encode())
out["status_line"] = raw.recv(4096).decode("latin-1").split("\\r\\n")[0]
raw.close()
ws = mod.SimpleWebSocketClient(f"ws://127.0.0.1:{port}/slackpolish/sync", headers={"Origin": ext_origin})
ws.connect()
hello = ws._recv_message(timeout=3)
out["hello"] = hello

try:
    bad = mod.SimpleWebSocketClient(f"ws://127.0.0.1:{port}/slackpolish/sync", headers={"Origin": "https://evil.example"})
    bad.connect(); out["web_ws"] = "connected"
except Exception as e:
    out["web_ws"] = str(e)

def post(path, headers, body):
    c = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
    c.request("POST", path, body=json.dumps(body), headers=headers)
    r = c.getresponse(); data = r.read().decode(); c.close()
    return r.status, data
slack_settings = {"language": "GERMAN", "style": "PROFESSIONAL", "improveHotkey": "Ctrl+Alt", "personalPolish": "short", "syncWithChrome": True, "savedAt": 1700000002000, "smartContext": {"enabled": True}}
s, d = post("/slackpolish/sync", {"Content-Type": "application/json", "Origin": "https://app.slack.com"}, {"source": "slack", "settings": slack_settings, "apiKey": "sk-from-slack"})
out["slack_save"] = {"status": s, "body": d}
out["relayed"] = ws._recv_message(timeout=3)
s, d = post("/slackpolish/sync", {"Content-Type": "application/json", "Origin": "https://evil.example"}, {"source": "slack", "settings": slack_settings, "apiKey": "sk-evil"})
out["web_save"] = {"status": s}
s, d = post("/slackpolish/sync", {"Content-Type": "application/json", "Origin": "https://app.slack.com"}, {"source": "slack", "settings": dict(slack_settings, syncWithChrome=False, savedAt=1700000003000), "apiKey": "sk-new"})
out["relayed_off"] = ws._recv_message(timeout=3)

ws._send_text(json.dumps({"type": "chrome-saved", "settings": {"language": "FRENCH", "style": "CASUAL", "improveHotkey": "Ctrl+Shift", "personalPolish": ""}, "apiKey": "sk-from-chrome", "savedAt": 1700000004000}))
ack = None
deadline = time.time() + 3
while time.time() < deadline:
    m = ws._recv_message(timeout=2)
    if m and m.get("type") == "chrome-saved-ack": ack = m; break
out["ack"] = ack
out["write_expression"] = evaluated[-1]

pinged = False
deadline = time.time() + 3
while time.time() < deadline:
    try:
        m = ws._recv_message(timeout=1.5)
    except Exception:
        break
    if m and m.get("type") == "ping": pinged = True; break
out["pinged"] = pinged
ws._send_text(json.dumps({"type": "pong"}))
ws.close()

s, d = post("/proxy/openai", {"Content-Type": "application/json"}, {"url": "https://api.openai.com/v1/chat/completions", "method": "POST", "headers": {"Authorization": "Bearer sk-legacy"}, "body": {"a": 1}})
out["legacy"] = {"status": s, "upstream": upstream[-1] if upstream else None}
print(json.dumps(out))
`;

let r = null;
runTest('Harness runs (python, fake upstream + fake Slack DevTools session)', () => {
    const res = spawnSync('python3', ['-c', harness], { encoding: 'utf8', timeout: 60000 });
    assert(res.status === 0, `harness failed (${res.status}): ${res.stderr.slice(-1200)}`);
    r = JSON.parse(res.stdout.trim().split('\n').pop());
});

runTest('Resolver: shared settings (no secrets, no Slack-only fields) and a correct write into Slack', () => {
    assert(r.shared && r.shared.language === 'HEBREW' && r.shared.improveHotkey === 'Ctrl+Alt' && r.shared.syncWithChrome === true && r.shared.savedAt === 1700000000000 && !('apiKey' in r.shared) && !('smartContext' in r.shared), `shared: ${JSON.stringify(r.shared)}`);
    assert(r.key === 'sk-from-slack', 'key read');
    assert(r.write.ok === true && !r.write.err, `write ok: ${JSON.stringify(r.write)}`);
    const ex = r.write.expression;
    assert(ex.includes('"style": "GRAMMAR"') && ex.includes('"improveHotkey": "Ctrl+Shift"') && ex.includes('"savedAt": 1700000001000') && !ex.includes('smartContext'), `only shared fields written: ${ex}`);
    assert(ex.includes('localStorage.setItem("slackpolish_openai_api_key", "sk-from-chrome")') && ex.includes("slackpolish-settings-updated") && ex.includes('Object.assign({}, current,'), 'key set, settings merged, Slack scripts told to reload');
});

runTest('WebSocket: extension gets hello with Slack state; web origins are refused', () => {
    assert(r.status_line === 'HTTP/1.1 101 Switching Protocols', `handshake status line as browsers require: ${r.status_line}`);
    assert(r.hello && r.hello.type === 'hello' && r.hello.slack && r.hello.slack.apiKey === 'sk-from-slack' && r.hello.slack.settings.style === 'CONCISE' && r.hello.slack.settings.syncWithChrome === true, `hello: ${JSON.stringify(r.hello)}`);
    assert(/handshake failed: HTTP\/1\.[01] 403/.test(r.web_ws), `web origin refused: ${r.web_ws}`);
});

runTest('A Save in Slack is relayed: settings only when sync is checked, the key always', () => {
    assert(r.slack_save.status === 200 && JSON.parse(r.slack_save.body).delivered === 1, `slack save accepted and delivered: ${JSON.stringify(r.slack_save)}`);
    assert(r.relayed && r.relayed.type === 'slack-saved' && r.relayed.settings && r.relayed.settings.style === 'PROFESSIONAL' && r.relayed.settings.improveHotkey === 'Ctrl+Alt' && !('smartContext' in r.relayed.settings) && r.relayed.apiKey === 'sk-from-slack' && r.relayed.savedAt === 1700000002000, `relayed: ${JSON.stringify(r.relayed)}`);
    assert(r.web_save.status === 401, `web origin cannot fake a Slack save: ${r.web_save.status}`);
    assert(r.relayed_off && r.relayed_off.type === 'slack-saved' && r.relayed_off.settings === null && r.relayed_off.syncWithChrome === false && r.relayed_off.apiKey === 'sk-new', `sync off -> key only: ${JSON.stringify(r.relayed_off)}`);
});

runTest('A Save in the extension is written into Slack and acknowledged; pings flow', () => {
    assert(r.ack && r.ack.ok === true, `ack: ${JSON.stringify(r.ack)}`);
    assert(r.write_expression.includes('"language": "FRENCH"') && r.write_expression.includes('"savedAt": 1700000004000') && r.write_expression.includes('"sk-from-chrome"'), `written expression: ${r.write_expression.slice(0, 200)}`);
    assert(r.pinged === true, 'server pings the extension');
});

runTest('Legacy /proxy/openai envelope (Slack scripts) still works', () => {
    assert(r.legacy.status === 200 && r.legacy.upstream && r.legacy.upstream.auth === 'Bearer sk-legacy', JSON.stringify(r.legacy));
});

console.log(`\n${'='.repeat(40)}`);
console.log(`📊 Total: ${testsTotal}  ✅ Passed: ${testsPassed}  ❌ Failed: ${testsTotal - testsPassed}`);
process.exit(testsPassed === testsTotal ? 0 : 1);
