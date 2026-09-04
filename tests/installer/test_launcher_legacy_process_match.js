#!/usr/bin/env node

/**
 * Installer Test: legacy-launcher process matching
 *
 * _terminate_legacy_launchers() used to kill ANY process whose command line
 * contained "launch-slackpolish-MAC-ARM.py" — including an editor, grep, cmp
 * or git diff on that file. It must only match a Python interpreter that is
 * actually executing the launcher script, including the real installed path
 * under "~/Library/Application Support/SlackPolish Runtime" (which contains
 * spaces that `ps` cannot distinguish from argument separators).
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
function pythonAvailable() { return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0; }

console.log('🚀 Running Legacy Launcher Process-Match Tests');
console.log('==============================================\n');

runTest('_terminate_legacy_launchers uses the strict matcher, not a substring test', () => {
    const start = source.indexOf('    def _terminate_legacy_launchers(self):');
    const end = source.indexOf('\n    def ', start + 10);
    assert(start !== -1 && end > start, 'Could not locate _terminate_legacy_launchers');
    const body = source.slice(start, end);
    assert(body.includes('is_launcher_process_command('), 'Should delegate to is_launcher_process_command');
    assert(!body.includes('"launch-slackpolish-MAC-ARM.py" not in line'), 'Bare substring check must be gone');
    assert(source.includes('def is_launcher_process_command(command_line):'), 'Matcher must be a module-level, testable function');
});

runTest('functional: matches real launcher invocations and rejects bystanders', () => {
    if (!pythonAvailable()) { console.log('   (python3 not available — skipping functional check)'); return; }
    const py = `
import importlib.util, sys, json, os, tempfile
spec = importlib.util.spec_from_file_location("launcher", sys.argv[1]); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
f = m.is_launcher_process_command
# Real installed layout: a path with spaces, as ps prints it (argv joined by spaces)
tmp = tempfile.mkdtemp()
spaced_dir = os.path.join(tmp, "Application Support", "SlackPolish Runtime", "mac-arm-runtime", "current")
os.makedirs(spaced_dir)
spaced_script = os.path.join(spaced_dir, "launch-slackpolish-MAC-ARM.py")
open(spaced_script, "w").write("# stub\\n")
PY = "/Library/Developer/CommandLineTools/Library/Frameworks/Python3.framework/Versions/3.9/Resources/Python.app/Contents/MacOS/Python"
positives = {
  "app_wrapper_spaced_path": f"{PY} {spaced_script} --attach-or-relaunch --launch-mode open --slack-path /Applications/Slack.app -v",
  "command_file_spaced_path": f"python3 {spaced_script} --relaunch --launch-mode open -v",
  "dev_run_relative": "python3 installers/launch-slackpolish-MAC-ARM.py --attach-only -v",
  "dev_run_versioned_interp": "/opt/homebrew/bin/python3.14 /repo/installers/launch-slackpolish-MAC-ARM.py",
  "interp_flag_unbuffered": "python3 -u /repo/installers/launch-slackpolish-MAC-ARM.py --relaunch",
  "shebang_direct": "/repo/installers/launch-slackpolish-MAC-ARM.py --attach-only",
  "via_env": "/usr/bin/env python3 /repo/installers/launch-slackpolish-MAC-ARM.py",
}
negatives = {
  "vim": "vim installers/launch-slackpolish-MAC-ARM.py",
  "less": "less /repo/installers/launch-slackpolish-MAC-ARM.py",
  "grep": "grep -n proxy installers/launch-slackpolish-MAC-ARM.py",
  "cmp": f"cmp installers/launch-slackpolish-MAC-ARM.py {spaced_script}",
  "git_diff": "git diff -- installers/launch-slackpolish-MAC-ARM.py",
  "zsh_c": "/bin/zsh -c cmp -s installers/launch-slackpolish-MAC-ARM.py /x/launch-slackpolish-MAC-ARM.py && echo ok",
  "python_c": "python3 -c print('launch-slackpolish-MAC-ARM.py')",
  "python_m": "python3 -m py_compile installers/launch-slackpolish-MAC-ARM.py",
  "python_other_script_with_arg": "python3 mytool.py /repo/installers/launch-slackpolish-MAC-ARM.py",
  "python_other_script_spaced_arg": f"python3 mytool.py {spaced_script}",
  "similar_name": "python3 tests/test_launch-slackpolish-MAC-ARM.py",
  "node_test": "node tests/installer/test_launcher_legacy_process_match.js",
  "tail_log": "tail -f /Users/x/Library/Application Support/SlackPolish Runtime/mac-arm-runtime/state/launcher.log",
  "empty": "",
  "just_python": "python3",
  "spaced_but_missing_file": f"python3 {tmp}/no such dir/launch-slackpolish-MAC-ARM.py --relaunch",
}
out = {"positives": {k: f(v) for k, v in positives.items()}, "negatives": {k: f(v) for k, v in negatives.items()}}
print(json.dumps(out))
`;
    const r = spawnSync('python3', ['-c', py, launcherPath], { encoding: 'utf8', timeout: 30000 });
    assert(r.status === 0, `python3 exited ${r.status}: ${r.stderr}`);
    const out = JSON.parse(r.stdout.trim().split('\n').pop());
    const missed = Object.entries(out.positives).filter(([, v]) => v !== true).map(([k]) => k);
    const wrongKills = Object.entries(out.negatives).filter(([, v]) => v !== false).map(([k]) => k);
    assert(missed.length === 0, `Real launcher invocations not recognised: ${missed.join(', ')}`);
    assert(wrongKills.length === 0, `Bystander processes would be killed: ${wrongKills.join(', ')}`);
});

console.log('\n==============================================');
console.log(`📊 Total: ${testsTotal}  ✅ Passed: ${testsPassed}  ❌ Failed: ${testsTotal - testsPassed}`);
process.exit(testsPassed === testsTotal ? 0 : 1);
