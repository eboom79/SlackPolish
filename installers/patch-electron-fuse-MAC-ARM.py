#!/usr/bin/env python3
"""
Inspect (and optionally flip) the EnableNodeCliInspectArguments fuse in the
Electron Framework inside Slack.app.

This is a TROUBLESHOOTING tool, not a required install step. Slack 4.52.155
(Electron 42) honours --remote-debugging-port with this fuse OFF, so the
installer no longer gates on it; it checks the live DevTools endpoint instead.
Only use this if the SlackPolish launcher reports that it cannot attach.

Slack's Electron Framework is a universal (x86_64 + arm64) binary and carries
one fuse block per architecture slice. Both slices are reported and patched;
earlier versions of this script only touched the first block found, which on
Apple Silicon is the x86_64 slice and therefore had no effect.

Patching requires admin privileges (will prompt via macOS dialog if needed).

Usage:
    python3 patch-electron-fuse-MAC-ARM.py [--slack-app <path>] [--check]

    --check     Only report the current fuse state, do not patch.
    --restore   Restore the original binary from backup.
"""

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path


GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
BLUE = "\033[94m"
RESET = "\033[0m"


def print_success(text): print(f"{GREEN}✅ {text}{RESET}", flush=True)
def print_warning(text): print(f"{YELLOW}⚠️  {text}{RESET}", flush=True)
def print_error(text):   print(f"{RED}❌ {text}{RESET}", flush=True)
def print_info(text):    print(f"{BLUE}🔍 {text}{RESET}", flush=True)


# The Electron fuse wire sentinel — a fixed 32-byte ASCII string baked
# into every Electron binary.
FUSE_SENTINEL = b"dL7pKGdnNz796PbbjQWNKmHXBZaB9tsX"

# Fuse names in wire order (Electron fuse wire v1).
FUSE_NAMES = [
    "RunAsNode",
    "EnableCookieEncryption",
    "EnableNodeOptionsEnvironmentVariable",
    "EnableNodeCliInspectArguments",     # index 3 — this is the one we need ON
    "EnableEmbeddedAsarIntegrityValidation",
    "OnlyLoadAppFromAsar",
    "LoadBrowserProcessSpecificV8Snapshot",
    "GrantFileProtocolExtraPrivileges",
    "WasmTrapHandlers",
]

# Mach-O universal binary header constants.
FAT_MAGIC = b"\xca\xfe\xba\xbe"
CPU_TYPE_NAMES = {0x01000007: "x86_64", 0x0100000C: "arm64"}

TARGET_FUSE_NAME = "EnableNodeCliInspectArguments"

# Backup directory — stored outside Slack.app so it survives across re-installs.
BACKUP_DIR = Path.home() / "Library" / "Application Support" / "SlackPolish Runtime" / "backups"


def find_slack_app(hint=None):
    if hint:
        p = Path(hint).expanduser()
        if not p.name.endswith(".app"):
            parts = str(p).split("/Contents/MacOS/")
            p = Path(parts[0] + ".app") if len(parts) == 2 else p
        if p.exists():
            return p
        print_error(f"Slack not found at: {hint}")
        return None

    for candidate in [Path("/Applications/Slack.app"), Path.home() / "Applications" / "Slack.app"]:
        if candidate.exists():
            return candidate
    return None


def find_electron_framework_binary(slack_app):
    # The symlink at the framework root resolves to Versions/Current/Electron Framework
    fw = (
        slack_app
        / "Contents"
        / "Frameworks"
        / "Electron Framework.framework"
        / "Versions"
        / "Current"
        / "Electron Framework"
    )
    if fw.exists():
        return fw
    # Fallback: follow the top-level symlink
    fw_sym = (
        slack_app
        / "Contents"
        / "Frameworks"
        / "Electron Framework.framework"
        / "Electron Framework"
    )
    if fw_sym.exists():
        return fw_sym
    print_error(f"Electron Framework binary not found inside: {slack_app}")
    return None


def _fat_slices(data):
    """Return [(arch, offset, size)] for a universal binary, or [] for a thin one."""
    if data[:4] != FAT_MAGIC:
        return []
    slices = []
    count = int.from_bytes(data[4:8], "big")
    for i in range(count):
        base = 8 + i * 20
        cpu_type = int.from_bytes(data[base:base + 4], "big")
        offset = int.from_bytes(data[base + 8:base + 12], "big")
        size = int.from_bytes(data[base + 12:base + 16], "big")
        slices.append((CPU_TYPE_NAMES.get(cpu_type, hex(cpu_type)), offset, size))
    return slices


def _slice_arch_for_offset(data, offset):
    slices = _fat_slices(data)
    if not slices:
        return "thin"
    for arch, start, size in slices:
        if start <= offset < start + size:
            return arch
    return "unknown"


def find_fuse_regions(data):
    """Return one region dict per fuse block in the binary (one per architecture slice)."""
    regions = []
    idx = data.find(FUSE_SENTINEL)
    while idx != -1:
        fuse_start = idx + len(FUSE_SENTINEL)
        version = data[fuse_start]
        count = data[fuse_start + 1]
        fuses = {}
        for i in range(min(count, len(FUSE_NAMES))):
            byte_offset = fuse_start + 2 + i
            val = data[byte_offset]
            fuses[FUSE_NAMES[i]] = {"offset": byte_offset, "value": val, "enabled": val == 0x31}
        regions.append({
            "sentinel_offset": idx,
            "fuse_start": fuse_start,
            "version": version,
            "count": count,
            "arch": _slice_arch_for_offset(data, idx),
            "fuses": fuses,
        })
        idx = data.find(FUSE_SENTINEL, fuse_start)
    return regions


def patch_fuse_bytes(data, fuse_name=TARGET_FUSE_NAME):
    """Flip ``fuse_name`` to ON in every fuse block. Returns (new_bytes, [patched offsets])."""
    patched = bytearray(data)
    offsets = []
    for region in find_fuse_regions(bytes(data)):
        fuse = region["fuses"].get(fuse_name)
        if fuse and not fuse["enabled"]:
            patched[fuse["offset"]] = 0x31  # '1' = enabled
            offsets.append(fuse["offset"])
    return bytes(patched), offsets


def check_fuses(slack_app):
    fw_path = find_electron_framework_binary(slack_app)
    if not fw_path:
        return None

    data = fw_path.read_bytes()
    regions = find_fuse_regions(data)
    if not regions:
        print_error("Fuse sentinel not found in Electron Framework binary.")
        print_error("This Electron version may use a different fuse format.")
        return None

    for region in regions:
        print_info(f"Electron Framework fuses in {slack_app.name} [{region['arch']} slice, wire v{region['version']}]:")
        for name, info in region["fuses"].items():
            status = "ON " if info["enabled"] else "OFF"
            marker = " ← target" if name == TARGET_FUSE_NAME else ""
            print(f"  [{status}] {name}{marker}")

    return regions


def _backup_path(fw_path):
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    return BACKUP_DIR / "Electron Framework.original"


def patch_fuse(slack_app, elevated=False):
    fw_path = find_electron_framework_binary(slack_app)
    if not fw_path:
        return False

    data = fw_path.read_bytes()
    regions = find_fuse_regions(data)

    if not regions:
        print_error("Fuse sentinel not found — cannot patch.")
        return False

    if any(r["fuses"].get(TARGET_FUSE_NAME) is None for r in regions):
        print_error(f"Fuse '{TARGET_FUSE_NAME}' not found in binary.")
        return False

    patched, offsets = patch_fuse_bytes(data)
    if not offsets:
        print_success(f"Fuse '{TARGET_FUSE_NAME}' is already ON in all {len(regions)} slice(s) — no patch needed.")
        return True

    backup = _backup_path(fw_path)
    if not backup.exists():
        print_info(f"Backing up original binary to: {backup}")
        try:
            shutil.copy2(fw_path, backup)
        except PermissionError:
            if elevated:
                print_error("Could not create backup even with elevated privileges.")
                return False
            return _rerun_as_admin()

    try:
        fw_path.write_bytes(patched)
    except PermissionError:
        if elevated:
            print_error("Could not write patched binary even with elevated privileges.")
            return False
        return _rerun_as_admin()

    archs = ", ".join(r["arch"] for r in regions if r["fuses"][TARGET_FUSE_NAME]["offset"] in offsets)
    print_success(f"Patched fuse '{TARGET_FUSE_NAME}' from OFF → ON in {len(offsets)} slice(s) [{archs}] at offsets {offsets}")
    return _resign(slack_app, elevated=elevated)


def restore_fuse(slack_app):
    fw_path = find_electron_framework_binary(slack_app)
    if not fw_path:
        return False

    backup = _backup_path(fw_path)
    if not backup.exists():
        print_warning("No backup file found — nothing to restore.")
        return True

    try:
        shutil.copy2(backup, fw_path)
    except PermissionError:
        return _rerun_as_admin(extra_args=["--restore"])

    backup.unlink(missing_ok=True)
    print_success("Restored original Electron Framework from backup.")
    return _resign(slack_app)


def _resign(slack_app, elevated=False):
    print_info("Re-signing Slack.app with an ad-hoc signature...")
    try:
        result = subprocess.run(
            ["codesign", "-f", "-s", "-", "--deep", str(slack_app)],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            # codesign often prints warnings to stderr but still succeeds (exit 0).
            # Only treat it as failure if exit code != 0.
            print_warning(f"codesign exited {result.returncode}:")
            if result.stderr:
                for line in result.stderr.strip().splitlines():
                    print_warning(f"  {line}")
            if elevated:
                return False
            return _rerun_as_admin()
        print_success("Re-signed Slack.app successfully.")
        return True
    except FileNotFoundError:
        print_error("codesign not found — Xcode Command Line Tools may not be installed.")
        print_error("Run: xcode-select --install")
        return False


def _rerun_as_admin(extra_args=None):
    """Re-launch this script with admin privileges via osascript."""
    script_path = Path(__file__).resolve()
    cmd_args = [sys.executable, str(script_path), "--_elevated"]
    if extra_args:
        cmd_args.extend(extra_args)
    # Pass through original sys.argv extras (e.g., --slack-app), excluding --_elevated
    for arg in sys.argv[1:]:
        if arg != "--_elevated":
            cmd_args.append(arg)

    # Build a POSIX shell command with each arg single-quoted for the shell,
    # then wrap that in an AppleScript double-quoted string literal (escaping
    # backslash and double-quote characters for AppleScript).
    shell_cmd = " ".join(_sh_quote(a) for a in cmd_args)
    # Escape for AppleScript string literal (double-quoted)
    osa_string = shell_cmd.replace("\\", "\\\\").replace('"', '\\"')
    osa_script = f'do shell script "{osa_string}" with administrator privileges'

    print_info("Admin privileges required. You will be prompted for your password...")
    try:
        result = subprocess.run(
            ["osascript", "-e", osa_script],
            capture_output=True,
            text=True,
        )
        if result.returncode != 0:
            print_error("Admin elevation failed or was cancelled.")
            if result.stderr:
                print_error(result.stderr.strip())
            return False
        if result.stdout.strip():
            print(result.stdout.strip())
        return True
    except Exception as exc:
        print_error(f"Could not request admin privileges: {exc}")
        return False


def _sh_quote(s):
    """POSIX shell single-quote escaping."""
    return "'" + str(s).replace("'", "'\"'\"'") + "'"


def needs_patch(slack_app):
    """Return True if the fuse patch is needed, False otherwise, None on error."""
    fw_path = find_electron_framework_binary(slack_app)
    if not fw_path:
        return None
    try:
        data = fw_path.read_bytes()
    except Exception:
        return None
    regions = find_fuse_regions(data)
    if not regions:
        return None
    targets = [r["fuses"].get(TARGET_FUSE_NAME) for r in regions]
    if any(t is None for t in targets):
        return None
    return any(not t["enabled"] for t in targets)


def parse_args():
    parser = argparse.ArgumentParser(
        description="Patch Electron fuse in Slack.app to enable --remote-debugging-port"
    )
    parser.add_argument("--slack-app", help="Path to Slack.app (auto-detected if omitted)")
    parser.add_argument("--check", action="store_true", help="Only check fuse state, do not patch")
    parser.add_argument("--restore", action="store_true", help="Restore original binary from backup")
    parser.add_argument("--_elevated", action="store_true", help=argparse.SUPPRESS)
    return parser.parse_args()


def main():
    args = parse_args()

    slack_app = find_slack_app(args.slack_app)
    if not slack_app:
        print_error("Could not find Slack.app. Use --slack-app <path>.")
        return 1

    print_info(f"Slack.app: {slack_app}")

    if args.restore:
        return 0 if restore_fuse(slack_app) else 1

    regions = check_fuses(slack_app)
    if regions is None:
        return 1

    if args.check:
        off_archs = [r["arch"] for r in regions
                     if r["fuses"].get(TARGET_FUSE_NAME) and not r["fuses"][TARGET_FUSE_NAME]["enabled"]]
        if off_archs:
            print_info(
                f"Fuse '{TARGET_FUSE_NAME}' is OFF in: {', '.join(off_archs)}. "
                "This does NOT by itself block SlackPolish: Slack 4.52+ honours "
                "--remote-debugging-port with this fuse OFF."
            )
            print_info("Only run this script without --check if the launcher reports it cannot attach to Slack.")
        else:
            print_success(f"Fuse '{TARGET_FUSE_NAME}' is ON in all slices.")
        return 0

    return 0 if patch_fuse(slack_app, elevated=args._elevated) else 1


if __name__ == "__main__":
    sys.exit(main())
