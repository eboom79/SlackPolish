#!/usr/bin/env node

/**
 * Installer Test: SlackPolish.app icon
 * The wrapper app must ship a real .icns (built with sips + iconutil) and must not
 * rely on a Finder "custom icon" set through osascript, which fails without
 * Automation permission and only ever printed a warning.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const installerPath = path.join(__dirname, '../../installers/install-slack-MAC-ARM.py');
const source = fs.readFileSync(installerPath, 'utf8');
let testsTotal = 0, testsPassed = 0;
function runTest(name, fn) { testsTotal++; try { console.log(`🧪 Testing: ${name}`); fn(); testsPassed++; console.log(`✅ PASSED: ${name}`); } catch (e) { console.log(`❌ FAILED: ${name}`); console.log(`   Error: ${e.message}`); } }
function assert(c, m) { if (!c) throw new Error(m || 'Assertion failed'); }

console.log('🚀 Running Installer App Icon Tests');
console.log('===================================\n');

runTest('Wrapper builds an .icns and no longer uses a Finder osascript icon', () => {
    assert(source.includes('def convert_png_to_icns(png_path, icns_path):'), 'convert_png_to_icns missing');
    assert(source.includes('["iconutil", "-c", "icns"'), 'iconutil must build the .icns');
    assert(source.includes('"CFBundleIconFile": "AppIcon" if has_icns else "AppIcon.png"'), 'Info.plist must point at the .icns when available');
    assert(!source.includes('tell application "Finder"'), 'Finder custom-icon osascript must be gone');
    assert(!source.includes('apply_custom_finder_icon('), 'apply_custom_finder_icon must not be called');
});

runTest('functional (macOS only): convert_png_to_icns produces a valid icns from the repo icon', () => {
    if (process.platform !== 'darwin') { console.log('   (not macOS — skipping)'); return; }
    const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'sp-icon-')), 'AppIcon.icns');
    const py = `
import importlib.util, sys, pathlib
spec = importlib.util.spec_from_file_location("inst", sys.argv[1]); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
png = pathlib.Path(sys.argv[1]).resolve().parent.parent / "assets" / "logos" / "SlackPolish app icon.png"
print(m.convert_png_to_icns(png, pathlib.Path(sys.argv[2])))
`;
    const r = spawnSync('python3', ['-c', py, installerPath, out], { encoding: 'utf8', timeout: 60000 });
    assert(r.status === 0, `python3 exited ${r.status}: ${r.stderr}`);
    assert(r.stdout.trim().endsWith('True'), `convert_png_to_icns returned ${r.stdout.trim()}`);
    const head = fs.readFileSync(out).subarray(0, 4).toString('ascii');
    assert(head === 'icns', `Output does not start with the icns magic (got "${head}")`);
    assert(fs.statSync(out).size > 10000, 'icns is suspiciously small');
});

console.log('\n===================================');
console.log(`📊 Total: ${testsTotal}  ✅ Passed: ${testsPassed}  ❌ Failed: ${testsTotal - testsPassed}`);
process.exit(testsPassed === testsTotal ? 0 : 1);
