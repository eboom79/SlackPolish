#!/usr/bin/env node

/**
 * Installer Test: Slack is launched with a dedicated profile (--user-data-dir)
 *
 * Slack 4.53 (Electron 45) refuses --remote-debugging-port unless --user-data-dir points outside the default
 * profile ("Refusing to launch: ..."). The launcher must pass a JustPolish profile, seed it once from the default
 * profile without caches/locks so the user stays signed in, keep Slack's own output for diagnosis, and stop
 * blaming the Electron fuse.
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

console.log('🚀 Running Launcher Dedicated-Profile Tests');
console.log('===========================================\n');

runTest('Static: launch args carry --user-data-dir first; Slack output is captured; no fuse blame', () => {
    assert(source.includes('SLACK_PROFILE_DIR = Path.home() / "Library" / "Application Support" / "SlackPolish Runtime" / "slack-profile"'), 'profile dir under the JustPolish runtime');
    assert(source.includes('f"--user-data-dir={profile_dir}",\n        f"--remote-debugging-port={debug_port}",'), 'profile switch precedes the debugging switch');
    assert(source.includes('state = ensure_slack_profile()') && source.indexOf('state = ensure_slack_profile()') < source.indexOf('debug_args = slack_launch_args(self.debug_port)'), 'profile is prepared before launching');
    assert(source.includes('["open", "--stdout", str(SLACK_STDERR_LOG), "--stderr", str(SLACK_STDERR_LOG), "-a", app_target, "--args", *debug_args]'), 'open mode keeps Slack stdout/stderr in the state dir');
    assert(source.includes('start_new_session=True'), 'Slack must not die with the launcher');
    assert(!source.includes('This prevents --remote-debugging-port from working'), 'the fuse is no longer presented as the cause');
    assert(source.includes('DEVTOOLS_PROFILE_GUARD = b"requires --user-data-dir pointing outside the default profile"') && source.includes('Slack said:'), 'diagnosis quotes Slack and recognises the dedicated-profile rule');
    assert(source.includes('self._wait_for_devtools(timeout=initial_timeout, diagnose=not self.attach_or_relaunch)') && source.includes('def _wait_for_devtools(self, timeout=20, diagnose=True):'), 'the quick attach probe before a planned relaunch must not print a diagnosis');
});

const harness = `
import importlib.util, json, os, sys, tempfile, pathlib
spec = importlib.util.spec_from_file_location("launcher", ${JSON.stringify(launcherPath)})
mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
tmp = pathlib.Path(tempfile.mkdtemp())
src = tmp / "Slack"; dst = tmp / "slack-profile"
for rel in ["Cache/data_0", "Code Cache/js/x", "GPUCache/x", "Service Worker/CacheStorage/a/b", "Service Worker/Database/000003.log", "Service Worker/Database/CURRENT", "logs/app.log", "Crashpad/settings.dat", "Local Storage/leveldb/000003.ldb", "Local Storage/leveldb/CURRENT", "IndexedDB/https_app.slack.com_0.indexeddb.leveldb/000005.ldb", "Cookies", "Preferences", "Local State", "SingletonLock", "SingletonSocket", "lockfile", "DevToolsActivePort", "storage/root-state.json"]:
    p = src / rel; p.parent.mkdir(parents=True, exist_ok=True); p.write_text("x")
out = {}
out["first"] = mod.ensure_slack_profile(src, dst)
out["copied"] = sorted(str(p.relative_to(dst)) for p in dst.rglob("*") if p.is_file())
(dst / "Local Storage" / "leveldb" / "000004.ldb").write_text("new")  # the live profile moves on
out["second"] = mod.ensure_slack_profile(src, dst)
out["still_has_new"] = (dst / "Local Storage" / "leveldb" / "000004.ldb").exists()
fresh = tmp / "fresh"; out["fresh"] = mod.ensure_slack_profile(tmp / "missing", fresh); out["fresh_exists"] = fresh.is_dir()
out["args"] = mod.slack_launch_args(9222, dst)
print(json.dumps(out))
`;
let r = null;
runTest('Functional: seeding copies sign-in and storage, skips caches/logs/locks, never overwrites a live profile', () => {
    const res = spawnSync('python3', ['-c', harness], { encoding: 'utf8', timeout: 60000 });
    assert(res.status === 0, `harness failed (${res.status}): ${res.stderr.slice(-800)}`);
    r = JSON.parse(res.stdout.trim().split('\n').pop());
    assert(r.first === 'seeded', `first call seeds: ${r.first}`);
    const kept = ['Cookies', 'Preferences', 'Local State', 'Local Storage/leveldb/000003.ldb', 'Local Storage/leveldb/CURRENT', 'IndexedDB/https_app.slack.com_0.indexeddb.leveldb/000005.ldb', 'storage/root-state.json', 'Service Worker/Database/CURRENT'];
    kept.forEach(f => assert(r.copied.includes(f), `kept: ${f}`));
    const dropped = ['Cache/data_0', 'Code Cache/js/x', 'GPUCache/x', 'Service Worker/CacheStorage/a/b', 'Service Worker/Database/000003.log', 'logs/app.log', 'Crashpad/settings.dat', 'SingletonLock', 'SingletonSocket', 'lockfile', 'DevToolsActivePort'];
    dropped.forEach(f => assert(!r.copied.includes(f), `dropped: ${f}`));
    assert(r.second === 'exists' && r.still_has_new === true, 'an existing profile is left alone');
    assert(r.fresh === 'fresh' && r.fresh_exists === true, 'no default profile -> empty profile dir, Slack will ask to sign in');
    assert(r.args[0].startsWith('--user-data-dir=') && r.args[1] === '--remote-debugging-port=9222' && r.args[2] === '--remote-allow-origins=*', `launch args: ${r.args}`);
});

console.log(`\n${'='.repeat(43)}`);
console.log(`📊 Total: ${testsTotal}  ✅ Passed: ${testsPassed}  ❌ Failed: ${testsTotal - testsPassed}`);
process.exit(testsPassed === testsTotal ? 0 : 1);
