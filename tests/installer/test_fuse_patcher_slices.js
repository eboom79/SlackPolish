#!/usr/bin/env node

/**
 * Installer Test: Electron fuse patcher handles universal (fat) binaries
 *
 * Slack's Electron Framework is x86_64 + arm64 and carries one fuse block per
 * slice. The patcher must report and patch every slice (the old code only
 * touched the first block found — the x86_64 slice — which is a no-op on
 * Apple Silicon), and must use Electron's real fuse names.
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const patcherPath = path.join(__dirname, '../../installers/patch-electron-fuse-MAC-ARM.py');
const source = fs.readFileSync(patcherPath, 'utf8');

let testsTotal = 0, testsPassed = 0;
function runTest(name, fn) {
    testsTotal++;
    try { console.log(`🧪 Testing: ${name}`); fn(); testsPassed++; console.log(`✅ PASSED: ${name}`); }
    catch (e) { console.log(`❌ FAILED: ${name}`); console.log(`   Error: ${e.message}`); }
}
function assert(c, m) { if (!c) throw new Error(m || 'Assertion failed'); }
function pythonAvailable() { return spawnSync('python3', ['--version'], { encoding: 'utf8' }).status === 0; }

console.log('🚀 Running Fuse Patcher Slice Tests');
console.log('===================================\n');

runTest('Fuse table matches Electron fuse wire v1', () => {
    assert(source.includes('"WasmTrapHandlers"'), '9th fuse must be WasmTrapHandlers (Electron build/fuses/fuses.json5)');
    assert(!source.includes('EnableRemoteDebuggingInAppPackage'), 'Fabricated fuse name must be gone');
});

runTest('Per-slice API exists and single-region reader is gone', () => {
    assert(source.includes('def find_fuse_regions(data):'), 'find_fuse_regions missing');
    assert(source.includes('def patch_fuse_bytes(data, fuse_name=TARGET_FUSE_NAME):'), 'patch_fuse_bytes missing');
    assert(source.includes('def _fat_slices(data):'), 'FAT header parser missing');
    assert(!source.includes('read_fuse_region('), 'Old first-match-only reader must not be used');
});

runTest('Messaging no longer claims the fuse blocks the DevTools port', () => {
    assert(!source.includes('JustPolish cannot open the DevTools port'), 'Stale claim must be removed');
    assert(source.includes('honours --remote-debugging-port with this fuse OFF'), 'Should document the verified behaviour');
});

runTest('functional: reads and patches both slices of a synthetic universal binary', () => {
    if (!pythonAvailable()) { console.log('   (python3 not available — skipping functional check)'); return; }
    const py = `
import importlib.util, sys, json, struct
spec = importlib.util.spec_from_file_location("patcher", sys.argv[1]); m = importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
def block(target_on):
    fuses = bytearray(b"01001100" + b"1")          # 9 fuses, wire v1 layout
    fuses[3] = ord("1") if target_on else ord("0")  # index 3 = EnableNodeCliInspectArguments
    return m.FUSE_SENTINEL + b"\\x01" + b"\\x09" + bytes(fuses)
# Build a FAT binary: header + 2 slices, each slice = padding + fuse block + padding
s0 = b"A"*64 + block(False) + b"B"*64
s1 = b"C"*32 + block(False) + b"D"*96
off0 = 8 + 2*20; off1 = off0 + len(s0)
hdr = m.FAT_MAGIC + struct.pack(">I", 2)
hdr += struct.pack(">IIIII", 0x01000007, 3, off0, len(s0), 12)   # x86_64
hdr += struct.pack(">IIIII", 0x0100000C, 0, off1, len(s1), 12)   # arm64
fat = hdr + s0 + s1
regions = m.find_fuse_regions(fat)
out = {"regions": [(r["arch"], r["version"], r["count"], r["fuses"]["EnableNodeCliInspectArguments"]["enabled"], r["fuses"]["WasmTrapHandlers"]["enabled"]) for r in regions]}
patched, offsets = m.patch_fuse_bytes(fat)
out["patched_offsets"] = len(offsets)
out["all_on_after"] = all(r["fuses"]["EnableNodeCliInspectArguments"]["enabled"] for r in m.find_fuse_regions(patched))
out["idempotent"] = m.patch_fuse_bytes(patched)[1] == []
out["only_target_changed"] = sum(1 for a, b in zip(fat, patched) if a != b) == 2
thin = b"x"*10 + block(True) + b"y"*10
out["thin_arch"] = m.find_fuse_regions(thin)[0]["arch"]
out["thin_no_patch"] = m.patch_fuse_bytes(thin)[1] == []
print(json.dumps(out))
`;
    const r = spawnSync('python3', ['-c', py, patcherPath], { encoding: 'utf8', timeout: 30000 });
    assert(r.status === 0, `python3 exited ${r.status}: ${r.stderr}`);
    const out = JSON.parse(r.stdout.trim().split('\n').pop());
    assert(out.regions.length === 2, `Expected 2 fuse regions, got ${out.regions.length}`);
    assert(out.regions[0][0] === 'x86_64' && out.regions[1][0] === 'arm64', `Arch labels wrong: ${JSON.stringify(out.regions)}`);
    assert(out.regions.every(r => r[1] === 1 && r[2] === 9), 'Wire version/count should be read per region');
    assert(out.regions.every(r => r[3] === false && r[4] === true), 'Target OFF and WasmTrapHandlers ON should be decoded');
    assert(out.patched_offsets === 2, `Both slices must be patched, got ${out.patched_offsets}`);
    assert(out.all_on_after === true, 'Target should be ON in every slice after patching');
    assert(out.idempotent === true, 'Re-patching an already-patched binary must change nothing');
    assert(out.only_target_changed === true, 'Exactly two bytes (one per slice) may change');
    assert(out.thin_arch === 'thin', 'Thin binaries should be labelled "thin"');
    assert(out.thin_no_patch === true, 'A thin binary with the fuse ON needs no patch');
});

console.log('\n===================================');
console.log(`📊 Total: ${testsTotal}  ✅ Passed: ${testsPassed}  ❌ Failed: ${testsTotal - testsPassed}`);
process.exit(testsPassed === testsTotal ? 0 : 1);
