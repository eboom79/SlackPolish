#!/usr/bin/env python3
"""
SlackPolish Installer for macOS ARM.

This installer does not modify Slack.app.
It installs the runtime launcher and SlackPolish assets into the user's
Application Support directory and creates convenient `.command` launchers.
"""

import argparse
import os
import plistlib
import shutil
import stat
import subprocess
import sys
from pathlib import Path


GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
BLUE = "\033[94m"
RESET = "\033[0m"

VERBOSE = False
SCRIPT_DIR = Path(__file__).resolve().parent
REPO_ROOT = SCRIPT_DIR.parent

RUNTIME_FILES = [
    "installers/launch-slackpolish-MAC-ARM.py",
    "slack-config.js",
    "logo-data.js",
    "slack-text-improver.js",
    "slack-settings.js",
    "docs/MACOS-RUNTIME-LAUNCHER.md",
]


def print_header(text):
    print(f"\n{BLUE}==================================================")
    print(text)
    print(f"=================================================={RESET}\n")


def print_success(text):
    print(f"{GREEN}✅ {text}{RESET}")


def print_warning(text):
    print(f"{YELLOW}⚠️ {text}{RESET}")


def print_error(text):
    print(f"{RED}❌ {text}{RESET}")


def print_info(text):
    print(f"{BLUE}🔍 {text}{RESET}")


def print_verbose(text):
    if VERBOSE:
        print(f"{BLUE}🔍 [VERBOSE] {text}{RESET}")


def detect_mac_architecture():
    import platform

    system = platform.system()
    machine = platform.machine().lower()
    if system != "Darwin":
        print_error(f"This installer is for macOS. Detected: {system}")
        return False
    if machine not in {"arm64", "aarch64"}:
        print_error(f"This installer is for Apple Silicon Macs. Detected: {machine}")
        return False
    print_success(f"Apple Silicon Mac detected ({machine})")
    return True


def find_slack_app():
    candidates = [
        Path("/Applications/Slack.app"),
        Path.home() / "Applications" / "Slack.app",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return None


def get_runtime_root():
    return Path.home() / "Library" / "Application Support" / "SlackPolish Runtime" / "mac-arm-runtime"


def get_current_runtime_dir():
    return get_runtime_root() / "current"


def get_desktop_launcher_path():
    return Path.home() / "Desktop" / "SlackPolish.command"


def get_desktop_attach_path():
    return Path.home() / "Desktop" / "SlackPolish-Attach.command"


def get_desktop_app_path():
    return Path.home() / "Desktop" / "SlackPolish.app"


def get_desktop_launch_app_path():
    return Path.home() / "Desktop" / "SlackPolish Launch.app"


def ensure_required_files():
    missing = [str(REPO_ROOT / rel) for rel in RUNTIME_FILES if not (REPO_ROOT / rel).exists()]
    if missing:
        print_error("Required runtime files are missing:")
        for path in missing:
            print_error(f"  {path}")
        return False
    print_success("All required runtime files found")
    return True


def recreate_dir(path):
    if path.exists():
        shutil.rmtree(path)
    path.mkdir(parents=True, exist_ok=True)


def copy_runtime_files(destination):
    recreate_dir(destination)
    for rel_path in RUNTIME_FILES:
        source = REPO_ROOT / rel_path
        target = destination / Path(rel_path).name
        shutil.copy2(source, target)
        print_verbose(f"Copied {source} -> {target}")


def write_command_file(path, runtime_dir, attach_only=False):
    launcher_path = runtime_dir / "launch-slackpolish-MAC-ARM.py"
    args = ["--launch-mode", "open", "-v"]
    if attach_only:
        args.insert(0, "--attach-only")
    else:
        args.insert(0, "--relaunch")

    path.parent.mkdir(parents=True, exist_ok=True)
    script = "\n".join([
        "#!/bin/zsh",
        "set -e",
        f"cd {shell_quote(str(runtime_dir))}",
        f"python3 {shell_quote(str(launcher_path))} {' '.join(shell_quote(arg) for arg in args)}",
        "",
    ])
    path.write_text(script, encoding="utf-8")
    mode = path.stat().st_mode
    path.chmod(mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)


def load_app_icon_png_bytes():
    icon_path = REPO_ROOT / "assets" / "logos" / "SlackPolish app icon.png"
    if not icon_path.exists():
        raise RuntimeError(f"Missing app icon asset: {icon_path}")
    return icon_path.read_bytes()


def apply_custom_finder_icon(target_path, png_path):
    script = (
        'tell application "Finder" '
        f'to set icon of (POSIX file "{target_path}") to (POSIX file "{png_path}")'
    )
    try:
        subprocess.run(
            ["osascript", "-e", script],
            check=True,
            capture_output=True,
            text=True,
        )
        print_verbose(f"Applied custom Finder icon to: {target_path}")
        return True
    except Exception as exc:
        print_warning(f"Could not apply custom Finder icon automatically: {exc}")
        return False


def write_app_wrapper(app_path, runtime_dir, attach_only=False):
    if app_path.exists():
        shutil.rmtree(app_path)

    contents = app_path / "Contents"
    macos_dir = contents / "MacOS"
    resources_dir = contents / "Resources"
    macos_dir.mkdir(parents=True, exist_ok=True)
    resources_dir.mkdir(parents=True, exist_ok=True)

    launcher_path = runtime_dir / "launch-slackpolish-MAC-ARM.py"
    args = ["--launch-mode", "open", "-v"]
    bundle_name = "SlackPolish"
    if attach_only:
        args.insert(0, "--attach-only")
    else:
        args.insert(0, "--relaunch")
        bundle_name = "SlackPolish Launch"

    executable = macos_dir / bundle_name
    if attach_only:
        script = "\n".join([
            "#!/bin/zsh",
            "set -e",
            f"cd {shell_quote(str(runtime_dir))}",
            "if pgrep -x Slack >/dev/null 2>&1; then",
            f"  exec python3 {shell_quote(str(launcher_path))} --attach-only --launch-mode open -v",
            "else",
            f"  exec python3 {shell_quote(str(launcher_path))} --relaunch --launch-mode open -v",
            "fi",
            "",
        ])
    else:
        script = "\n".join([
            "#!/bin/zsh",
            "set -e",
            f"cd {shell_quote(str(runtime_dir))}",
            f"exec python3 {shell_quote(str(launcher_path))} {' '.join(shell_quote(arg) for arg in args)}",
            "",
        ])
    executable.write_text(script, encoding="utf-8")
    executable.chmod(executable.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)

    icon_path = resources_dir / "AppIcon.png"
    icon_path.write_bytes(load_app_icon_png_bytes())

    plist = {
        "CFBundleDevelopmentRegion": "en",
        "CFBundleDisplayName": bundle_name,
        "CFBundleExecutable": bundle_name,
        "CFBundleIconFile": "AppIcon.png",
        "CFBundleIconName": "AppIcon",
        "CFBundleIdentifier": f"local.slackpolish.{'attach' if attach_only else 'launch'}",
        "CFBundleInfoDictionaryVersion": "6.0",
        "CFBundleName": bundle_name,
        "CFBundlePackageType": "APPL",
        "CFBundleShortVersionString": "1.0",
        "CFBundleVersion": "1",
        "LSUIElement": False,
        "NSHighResolutionCapable": True,
    }
    with open(contents / "Info.plist", "wb") as handle:
        plistlib.dump(plist, handle)

    apply_custom_finder_icon(str(app_path), str(icon_path))


def shell_quote(value):
    return "'" + value.replace("'", "'\"'\"'") + "'"


def install_runtime():
    runtime_root = get_runtime_root()
    current_dir = get_current_runtime_dir()

    runtime_root.mkdir(parents=True, exist_ok=True)
    copy_runtime_files(current_dir)
    write_command_file(get_desktop_launcher_path(), current_dir, attach_only=False)
    write_command_file(get_desktop_attach_path(), current_dir, attach_only=True)
    write_app_wrapper(get_desktop_app_path(), current_dir, attach_only=True)

    legacy_launch_app = get_desktop_launch_app_path()
    if legacy_launch_app.exists():
        shutil.rmtree(legacy_launch_app)
        print_success(f"Removed legacy Desktop launch app: {legacy_launch_app}")

    launcher = current_dir / "launch-slackpolish-MAC-ARM.py"
    launcher.chmod(launcher.stat().st_mode | stat.S_IXUSR)

    print_success(f"Runtime installed to: {current_dir}")
    print_success(f"Desktop launcher created: {get_desktop_launcher_path()}")
    print_success(f"Desktop attach launcher created: {get_desktop_attach_path()}")
    print_success(f"Desktop app created: {get_desktop_app_path()}")
    return current_dir


def parse_args():
    parser = argparse.ArgumentParser(description="Install SlackPolish runtime launcher for macOS ARM")
    parser.add_argument("-v", "--verbose", action="store_true", help="Enable verbose output")
    return parser.parse_args()


def main():
    global VERBOSE
    args = parse_args()
    VERBOSE = args.verbose

    print_header("🍎 SlackPolish Runtime Installer for macOS ARM")

    if not detect_mac_architecture():
        return 1

    if not ensure_required_files():
        return 1

    slack_app = find_slack_app()
    if slack_app:
        print_success(f"Found Slack at: {slack_app}")
    else:
        print_warning("Slack.app was not found in /Applications or ~/Applications")
        print_warning("You can still install the runtime launcher now and launch Slack later.")

    print_info("Installing SlackPolish runtime launcher without modifying Slack.app...")
    runtime_dir = install_runtime()

    print_header("✅ Installation Completed")
    print("Slack.app was not modified.")
    print(f"Runtime files: {runtime_dir}")
    print(f"Launch SlackPolish from: {get_desktop_launcher_path()}")
    print("")
    print("Recommended use:")
    print(f"  {get_desktop_app_path()}")
    print("")
    print("Alternative launchers:")
    print(f"  Smart attach-or-launch app: {get_desktop_app_path()}")
    print(f"  Command launcher: {get_desktop_launcher_path()}")
    print(f"  Command attach: {get_desktop_attach_path()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
