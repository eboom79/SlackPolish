#!/usr/bin/env node

/**
 * Installer Test: remote-debugging capability check
 *
 * The macOS installer used to gate on an Electron fuse byte and told users to
 * sudo-patch Slack.app even when remote debugging already worked (Slack 4.52
 * honours --remote-debugging-port with that fuse OFF). It must now probe the
 * live DevTools endpoint and never print the sudo hint.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const installerPath = path.join(__dirname, '../../installers/install-slack-MAC-ARM.py');
const source = fs.readFileSync(installerPath, 'utf8');

let testsTotal = 0, testsPassed = 0;
function runTest(name, fn) {
    testsTotal++;
    try { console.log(`🧪 Testing: ${name}`); fn(); testsPassed++; console.log(`✅ PASSED: ${name}`); }
    catch (e) { console.log(`❌ FAILED: ${name}`); console.log(`   Error: ${e.message}`); }
}
function assert(c, m) { if (!c) throw new Error(m || 'Assertion failed'); }
function pythonAvailable() { return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0; }

console.log('🚀 Running Installer Remote-Debugging Check Tests');
console.log('=================================================\n');

runTest('Installer probes the live DevTools endpoint instead of fuse bytes', () => {
    assert(source.includes('def check_remote_debugging(port=DEFAULT_DEBUG_PORT'), 'check_remote_debugging missing');
    assert(source.includes('/json/version'), 'Should query the DevTools /json/version endpoint');
    assert(source.includes('_report_remote_debugging(slack_app)'), 'main() should report remote-debugging status');
});

runTest('Fuse-byte gate and sudo hint are gone', () => {
    assert(!source.includes('_ensure_patched_slack_app'), 'Fuse gate function must be removed');
    assert(!source.includes('_load_fuse_patcher'), 'Installer must not load the fuse patcher');
    assert(!source.includes('needs_patch'), 'Installer must not consult needs_patch');
    assert(!source.includes('Run manually with sudo'), 'Installer must not tell users to sudo-patch Slack');
    assert(!source.includes('you may be prompted for your password'), 'Installer must not attempt in-place patching');
});

runTest('functional: check_remote_debugging is true for a DevTools-like endpoint, false otherwise', () => {
    if (!pythonAvailable()) { console.log('   (python3 not available — skipping functional check)'); return; }
    const py = `
import importlib.util, sys, json, threading, http.server, socket
spec = importlib.util.spec_from_file_location("installer", sys.argv[1]); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        body = json.dumps({"Browser": "Chrome/140", "webSocketDebuggerUrl": "ws://127.0.0.1/devtools/browser/x"}).encode()
        self.send_response(200); self.send_header("Content-Type", "application/json"); self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)
    def log_message(self, *a): pass
srv = http.server.HTTPServer(("127.0.0.1", 0), H); port = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
out = {"devtools_like": m.check_remote_debugging(port, timeout=2.0)}
srv.shutdown(); srv.server_close()
s = socket.socket(); s.bind(("127.0.0.1", 0)); closed_port = s.getsockname()[1]; s.close()
out["closed_port"] = m.check_remote_debugging(closed_port, timeout=0.5)
class Bad(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        body = b"<html>not devtools</html>"; self.send_response(200); self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)
    def log_message(self, *a): pass
srv2 = http.server.HTTPServer(("127.0.0.1", 0), Bad); threading.Thread(target=srv2.serve_forever, daemon=True).start()
out["non_devtools_http"] = m.check_remote_debugging(srv2.server_address[1], timeout=2.0)
srv2.shutdown(); srv2.server_close()
print(json.dumps(out))
`;
    const r = spawnSync('python3', ['-c', py, installerPath], { encoding: 'utf8', timeout: 30000 });
    assert(r.status === 0, `python3 exited ${r.status}: ${r.stderr}`);
    const out = JSON.parse(r.stdout.trim().split('\n').pop());
    assert(out.devtools_like === true, 'A DevTools-like /json/version response must be detected');
    assert(out.closed_port === false, 'A closed port must not be treated as remote debugging');
    assert(out.non_devtools_http === false, 'A non-DevTools HTTP server must not be treated as remote debugging');
});

console.log('\n=================================================');
console.log(`📊 Total: ${testsTotal}  ✅ Passed: ${testsPassed}  ❌ Failed: ${testsTotal - testsPassed}`);
process.exit(testsPassed === testsTotal ? 0 : 1);
