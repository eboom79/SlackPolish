#!/usr/bin/env node

/**
 * Installer Test: the launcher's local proxy shares the OpenAI key saved in Slack with the Chrome extension
 *
 * /v1/chat/completions: a request without Authorization from a chrome-extension:// origin is forwarded with
 * the key SlackPolish keeps in Slack's localStorage (looked up over DevTools, cached); the same request from a
 * web origin is refused; a request with its own Authorization passes through untouched; the legacy
 * /proxy/openai envelope used by the Slack scripts keeps working.
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

console.log('🚀 Running Launcher Shared-Key Proxy Tests');
console.log('==========================================\n');

runTest('run() starts the proxy with a SlackKeyResolver bound to the debug port; key is never written to disk', () => {
    assert(source.includes('start_openai_proxy(self.proxy_port, key_resolver=SlackKeyResolver(self.debug_port))'), 'proxy must get a resolver for the Slack key');
    assert(source.includes('STORAGE_KEY = "slackpolish_openai_api_key"'), 'resolver reads the same localStorage key the Slack script saves');
    const resolver = source.slice(source.indexOf('class SlackKeyResolver'), source.indexOf('class _OpenAIProxyHandler'));
    assert(!/(?<![A-Za-z_.])open\(|write_text|json\.dump\(|\.write\(/.test(resolver), 'resolver must not persist the key');
    assert(source.includes('if not origin.startswith("chrome-extension://"):'), 'shared key only for browser-extension origins');
});

const harness = `
import importlib.util, json, threading, http.server, http.client, io, urllib.request
spec = importlib.util.spec_from_file_location("launcher", ${JSON.stringify(launcherPath)})
mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)

calls = []
class FakeResp(io.BytesIO):
    status = 200
    headers = {}
    def __enter__(self): return self
    def __exit__(self, *a): return False
def fake_urlopen(req, timeout=None):
    url = req.full_url if hasattr(req, "full_url") else str(req)
    if url.endswith("/json/list"):
        return FakeResp(json.dumps([
            {"type": "background_page", "url": "chrome-extension://x/bg.html", "webSocketDebuggerUrl": "ws://127.0.0.1:1/x"},
            {"type": "page", "url": "https://app.slack.com/client/T1/C1", "webSocketDebuggerUrl": "ws://127.0.0.1:1/slack"}
        ]).encode())
    calls.append({"url": url, "auth": req.get_header("Authorization"), "body": req.data.decode()})
    return FakeResp(json.dumps({"choices": [{"message": {"content": "polished"}}]}).encode())
urllib.request.urlopen = fake_urlopen

sessions = []
class FakeSession:
    def __init__(self, target): self.target = target; sessions.append(target["url"])
    def connect(self): pass
    def evaluate_expression(self, expression):
        assert "slackpolish_openai_api_key" in expression, expression
        return {"id": 7, "result": {"result": {"type": "string", "value": "sk-from-slack"}}}
    def close(self): pass
mod.SlackTargetSession = FakeSession

out = {}
resolver = mod.SlackKeyResolver(9222)
out["resolver_first"] = resolver.get()
out["resolver_cached"] = resolver.get()
out["resolver_sessions"] = sessions[:]

class Fixed:
    def __init__(self, key): self.key = key
    def get(self): return self.key
server = http.server.HTTPServer(("127.0.0.1", 0), mod._OpenAIProxyHandler)
server.key_resolver = Fixed("sk-from-slack")
threading.Thread(target=server.serve_forever, daemon=True).start()
port = server.server_address[1]
def post(path, headers, body):
    c = http.client.HTTPConnection("127.0.0.1", port, timeout=5)
    c.request("POST", path, body=json.dumps(body), headers=headers)
    r = c.getresponse(); data = r.read().decode(); c.close()
    return r.status, data
chat = {"model": "gpt-4-turbo", "messages": [{"role": "user", "content": "hi"}]}
s, d = post("/v1/chat/completions", {"Content-Type": "application/json", "Origin": "chrome-extension://abcdefghijklmnopabcdefghijklmnop"}, chat)
out["ext_no_auth"] = {"status": s, "body": d, "upstream": calls[-1] if calls else None, "calls": len(calls)}
s, d = post("/v1/chat/completions", {"Content-Type": "application/json", "Origin": "https://evil.example"}, chat)
out["web_no_auth"] = {"status": s, "body": d, "calls": len(calls)}
s, d = post("/v1/chat/completions", {"Content-Type": "application/json"}, chat)
out["no_origin_no_auth"] = {"status": s, "calls": len(calls)}
s, d = post("/v1/chat/completions", {"Content-Type": "application/json", "Authorization": "Bearer sk-own", "Origin": "chrome-extension://abc"}, chat)
out["own_auth"] = {"status": s, "upstream": calls[-1], "calls": len(calls)}
server.key_resolver = Fixed("")
s, d = post("/v1/chat/completions", {"Content-Type": "application/json", "Origin": "chrome-extension://abc"}, chat)
out["ext_no_key_in_slack"] = {"status": s, "body": d, "calls": len(calls)}
s, d = post("/proxy/openai", {"Content-Type": "application/json"}, {"url": "https://api.openai.com/v1/chat/completions", "method": "POST", "headers": {"Authorization": "Bearer sk-legacy"}, "body": {"a": 1}})
out["legacy_envelope"] = {"status": s, "upstream": calls[-1], "calls": len(calls), "body": d}
server.shutdown()
print(json.dumps(out))
`;

let result = null;
runTest('Proxy behaviour (python harness with a fake upstream and a fake Slack DevTools session)', () => {
    const r = spawnSync('python3', ['-c', harness], { encoding: 'utf8', timeout: 60000 });
    assert(r.status === 0, `harness failed (${r.status}): ${r.stderr.slice(-800)}`);
    result = JSON.parse(r.stdout.trim().split('\n').pop());
});

runTest('SlackKeyResolver reads the key from the Slack page target only, and caches it', () => {
    assert(result, 'harness did not run');
    assert(result.resolver_first === 'sk-from-slack' && result.resolver_cached === 'sk-from-slack', `resolver value: ${result.resolver_first}/${result.resolver_cached}`);
    assert(JSON.stringify(result.resolver_sessions) === JSON.stringify(['https://app.slack.com/client/T1/C1']), `one DevTools session on the Slack page only: ${JSON.stringify(result.resolver_sessions)}`);
});

runTest('Extension request without a key is forwarded with the key saved in Slack', () => {
    const e = result.ext_no_auth;
    assert(e.status === 200 && e.calls === 1 && e.upstream.url === 'https://api.openai.com/v1/chat/completions' && e.upstream.auth === 'Bearer sk-from-slack', `got ${JSON.stringify(e)}`);
    assert(JSON.parse(e.body).choices[0].message.content === 'polished' && JSON.parse(e.upstream.body).model === 'gpt-4-turbo', 'OpenAI response passed through verbatim');
});

runTest('Web pages (or no Origin) cannot use the shared key', () => {
    assert(result.web_no_auth.status === 401 && result.web_no_auth.calls === 1 && /only shared with the SlackPolish browser extension/.test(result.web_no_auth.body), `web origin: ${JSON.stringify(result.web_no_auth)}`);
    assert(result.no_origin_no_auth.status === 401 && result.no_origin_no_auth.calls === 1, `no origin: ${JSON.stringify(result.no_origin_no_auth)}`);
});

runTest('A request with its own Authorization passes through untouched', () => {
    assert(result.own_auth.status === 200 && result.own_auth.upstream.auth === 'Bearer sk-own' && result.own_auth.calls === 2, JSON.stringify(result.own_auth));
});

runTest('No key saved in Slack -> clear 401 telling where to enter it, nothing forwarded', () => {
    const e = result.ext_no_key_in_slack;
    assert(e.status === 401 && e.calls === 2 && /No OpenAI key is saved in Slack yet/.test(e.body), JSON.stringify(e));
});

runTest('Legacy /proxy/openai envelope (Slack scripts) still works', () => {
    const e = result.legacy_envelope;
    assert(e.status === 200 && e.calls === 3 && e.upstream.auth === 'Bearer sk-legacy' && JSON.parse(e.body).status === 200, JSON.stringify(e));
});

console.log(`\n${'='.repeat(42)}`);
console.log(`📊 Total: ${testsTotal}  ✅ Passed: ${testsPassed}  ❌ Failed: ${testsTotal - testsPassed}`);
process.exit(testsPassed === testsTotal ? 0 : 1);
