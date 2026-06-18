#!/usr/bin/env python3
"""
Patch the Electron Framework inside Slack.app to enable the
EnableNodeCliInspectArguments fuse so that --remote-debugging-port works.

Slack 4.45+ ships Electron with this fuse disabled, which prevents
SlackPolish from opening a DevTools endpoint for injection.

Requires admin privileges (will prompt via macOS dialog if needed).

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
    "EnableRemoteDebuggingInAppPackage",
]

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


def read_fuse_region(data):
    idx = data.find(FUSE_SENTINEL)
    if idx == -1:
        return None, None
    fuse_start = idx + len(FUSE_SENTINEL)
    count = data[fuse_start + 1]
    fuses = {}
    for i in range(min(count, len(FUSE_NAMES))):
        byte_offset = fuse_start + 2 + i
        val = data[byte_offset]
        name = FUSE_NAMES[i]
        fuses[name] = {"offset": byte_offset, "value": val, "enabled": val == 0x31}
    return fuse_start, fuses


def check_fuses(slack_app):
    fw_path = find_electron_framework_binary(slack_app)
    if not fw_path:
        return None

    data = fw_path.read_bytes()
    _, fuses = read_fuse_region(data)
    if fuses is None:
        print_error("Fuse sentinel not found in Electron Framework binary.")
        print_error("This Electron version may use a different fuse format.")
        return None

    print_info(f"Electron Framework fuses in {slack_app.name}:")
    for name, info in fuses.items():
        status = "ON " if info["enabled"] else "OFF"
        marker = " ← target" if name == TARGET_FUSE_NAME else ""
        print(f"  [{status}] {name}{marker}")

    return fuses


def _backup_path(fw_path):
    BACKUP_DIR.mkdir(parents=True, exist_ok=True)
    return BACKUP_DIR / "Electron Framework.original"


def patch_fuse(slack_app, elevated=False):
    fw_path = find_electron_framework_binary(slack_app)
    if not fw_path:
        return False

    data = bytearray(fw_path.read_bytes())
    _, fuses = read_fuse_region(bytes(data))

    if fuses is None:
        print_error("Fuse sentinel not found — cannot patch.")
        return False

    target = fuses.get(TARGET_FUSE_NAME)
    if target is None:
        print_error(f"Fuse '{TARGET_FUSE_NAME}' not found in binary.")
        return False

    if target["enabled"]:
        print_success(f"Fuse '{TARGET_FUSE_NAME}' is already ON — no patch needed.")
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

    offset = target["offset"]
    data[offset] = 0x31  # '1' = enabled

    try:
        fw_path.write_bytes(bytes(data))
    except PermissionError:
        if elevated:
            print_error("Could not write patched binary even with elevated privileges.")
            return False
        return _rerun_as_admin()

    print_success(f"Patched fuse '{TARGET_FUSE_NAME}' from OFF → ON at offset {offset}")
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
    _, fuses = read_fuse_region(data)
    if fuses is None:
        return None
    target = fuses.get(TARGET_FUSE_NAME)
    if target is None:
        return None
    return not target["enabled"]


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

    fuses = check_fuses(slack_app)
    if fuses is None:
        return 1

    if args.check:
        target = fuses.get(TARGET_FUSE_NAME)
        if target and not target["enabled"]:
            print_warning(
                f"Fuse '{TARGET_FUSE_NAME}' is OFF — SlackPolish cannot open the DevTools port."
            )
            print_warning("Run this script without --check to apply the one-byte patch.")
        return 0

    return 0 if patch_fuse(slack_app, elevated=args._elevated) else 1


if __name__ == "__main__":
    sys.exit(main())
