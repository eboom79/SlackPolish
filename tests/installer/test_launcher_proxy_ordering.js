#!/usr/bin/env node

/**
 * Installer Test: launcher OpenAI-proxy startup ordering
 *
 * Regression test for "Address already in use" when clicking JustPolish.app
 * while a launcher is already running. The proxy port (debug_port + 1) is held
 * by the previous launcher, so it must be bound only AFTER the single-instance
 * lock has terminated that launcher, and the bind must retry briefly.
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
function pythonAvailable() {
    const r = spawnSync('python3', ['--version'], { encoding: 'utf8' });
    return r.status === 0;
}

console.log('🚀 Running Launcher Proxy Ordering Tests');
console.log('========================================\n');

runTest('__init__ no longer binds the proxy port', () => {
    const initStart = source.indexOf('    def __init__(', source.indexOf('class SlackPolishMacLauncher'));
    const runStart = source.indexOf('    def run(self):');
    assert(initStart !== -1 && runStart !== -1 && runStart > initStart, 'Could not locate __init__/run');
    const initBody = source.slice(initStart, runStart);
    assert(!initBody.includes('start_openai_proxy('), '__init__ must not call start_openai_proxy (port is still held by the old launcher)');
});

runTest('run() binds the proxy only after the single-instance lock is acquired', () => {
    const runStart = source.indexOf('    def run(self):');
    const runBody = source.slice(runStart, source.indexOf('\n    def ', runStart + 10));
    const lockIdx = runBody.indexOf('self._acquire_or_recover_single_instance_lock()');
    const proxyIdx = runBody.indexOf('start_openai_proxy(self.proxy_port');
    assert(lockIdx !== -1, 'run() should acquire the single-instance lock');
    assert(proxyIdx !== -1, 'run() should start the OpenAI proxy');
    assert(lockIdx < proxyIdx, 'Lock acquisition must happen before the proxy bind');
});

runTest('start_openai_proxy retries on EADDRINUSE and raises a clear error', () => {
    assert(/def start_openai_proxy\(port, timeout=/.test(source), 'start_openai_proxy should accept a timeout');
    assert(source.includes('errno.EADDRINUSE'), 'Bind loop should recognise EADDRINUSE');
    assert(source.includes('is still in use after'), 'Failure should name the port and duration');
    assert(/^import errno$/m.test(source), 'errno must be imported');
});

runTest('functional: bind retries then fails while port is held, succeeds once released', () => {
    if (!pythonAvailable()) { console.log('   (python3 not available — skipping functional check)'); return; }
    const py = `
import importlib.util, socket, sys, time, urllib.request, json
spec = importlib.util.spec_from_file_location("launcher", sys.argv[1]); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
holder = socket.socket(); holder.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1); holder.bind(("127.0.0.1", 0)); holder.listen(1)
port = holder.getsockname()[1]
out = {"port": port}
t0 = time.monotonic()
try:
    m.start_openai_proxy(port, timeout=0.6, poll_interval=0.1); out["held"] = "no-error"
except RuntimeError as e:
    out["held"] = "RuntimeError"; out["msg"] = str(e)
out["elapsed"] = round(time.monotonic() - t0, 2)
holder.close()
out["after_release"] = m.start_openai_proxy(port, timeout=2.0)
try:
    urllib.request.urlopen(f"http://127.0.0.1:{port}/", timeout=2).read()
    out["serving"] = True
except urllib.error.HTTPError as e:
    out["serving"] = True  # any HTTP status means the proxy answered
except Exception as e:
    out["serving"] = False; out["serve_error"] = str(e)
print(json.dumps(out))
`;
    const r = spawnSync('python3', ['-c', py, launcherPath], { encoding: 'utf8', timeout: 30000 });
    assert(r.status === 0, `python3 exited ${r.status}: ${r.stderr}`);
    const out = JSON.parse(r.stdout.trim().split('\n').pop());
    assert(out.held === 'RuntimeError', `Expected RuntimeError while port held, got ${out.held}`);
    assert(/in use/.test(out.msg), `Error should mention the port is in use: ${out.msg}`);
    assert(out.elapsed >= 0.5 && out.elapsed < 5, `Should retry for ~timeout before failing (elapsed ${out.elapsed}s)`);
    assert(out.after_release === out.port, 'Bind should succeed once the port is released');
    assert(out.serving === true, `Proxy should answer HTTP after binding: ${out.serve_error || ''}`);
});

console.log('\n========================================');
console.log(`📊 Total: ${testsTotal}  ✅ Passed: ${testsPassed}  ❌ Failed: ${testsTotal - testsPassed}`);
process.exit(testsPassed === testsTotal ? 0 : 1);
