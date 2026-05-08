#!/usr/bin/env python3
"""
SlackPolish Installer for macOS ARM.

This installer does not modify Slack.app.
It installs the runtime launcher and SlackPolish assets into the user's
Application Support directory and creates convenient `.command` launchers.
"""

import argparse
import json
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
    "slack-channel-summary.js",
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


def get_desktop_app_path():
    return Path.home() / "Desktop" / "SlackPolish.app"


def get_desktop_launch_app_path():
    return Path.home() / "Desktop" / "SlackPolish Launch.app"


def get_runtime_app_path():
    return get_runtime_root() / "SlackPolish.app"


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


def convert_png_to_icns(png_path, icns_path):
    """Convert a PNG to .icns using macOS iconutil (required for proper Dock icon display)."""
    import tempfile
    iconset_dir = Path(tempfile.mkdtemp()) / "AppIcon.iconset"
    iconset_dir.mkdir()
    sizes = [16, 32, 64, 128, 256, 512]
    try:
        for size in sizes:
            for scale, suffix in ((1, ""), (2, "@2x")):
                px = size * scale
                out = iconset_dir / f"icon_{size}x{size}{suffix}.png"
                subprocess.run(
                    ["sips", "-z", str(px), str(px), str(png_path), "--out", str(out)],
                    check=True,
                    capture_output=True,
                )
        subprocess.run(
            ["iconutil", "-c", "icns", str(iconset_dir), "-o", str(icns_path)],
            check=True,
            capture_output=True,
        )
        print_verbose(f"Created .icns icon: {icns_path}")
        return True
    except Exception as exc:
        print_warning(f"Could not create .icns icon: {exc}")
        return False
    finally:
        shutil.rmtree(str(iconset_dir.parent), ignore_errors=True)


def build_app_shell_command(runtime_dir):
    launcher_path = runtime_dir / "launch-slackpolish-MAC-ARM.py"
    log_dir = Path.home() / "Library" / "Application Support" / "SlackPolish Runtime" / "mac-arm-runtime" / "state"
    log_path = log_dir / "launcher.log"
    return (
        f"mkdir -p {shell_quote(str(log_dir))} && "
        f"cd {shell_quote(str(runtime_dir))} && "
        f"nohup python3 {shell_quote(str(launcher_path))} --attach-or-relaunch --launch-mode open -v >>{shell_quote(str(log_path))} 2>&1 & "
    )


def json_string_literal(value):
    return json.dumps(value)


def write_jxa_app(app_path, shell_command):
    if app_path.exists():
        shutil.rmtree(app_path)

    wrapped_shell_command = "/bin/zsh -lc " + shell_quote(shell_command)
    jxa_source = "\n".join([
        "function run() {",
        "  var app = Application.currentApplication();",
        "  app.includeStandardAdditions = true;",
        f'  return app.doShellScript({json_string_literal(wrapped_shell_command)});',
        "}",
        "",
    ])

    source_path = app_path.with_suffix(".js")
    source_path.write_text(jxa_source, encoding="utf-8")
    try:
        subprocess.run(
            ["/usr/bin/osacompile", "-l", "JavaScript", "-o", str(app_path), str(source_path)],
            check=True,
            capture_output=True,
            text=True,
        )
    finally:
        if source_path.exists():
            source_path.unlink()


def write_app_wrapper(app_path, runtime_dir):
    write_jxa_app(app_path, build_app_shell_command(runtime_dir))

    contents = app_path / "Contents"
    resources_dir = contents / "Resources"
    resources_dir.mkdir(parents=True, exist_ok=True)

    png_path = resources_dir / "AppIcon.png"
    png_path.write_bytes(load_app_icon_png_bytes())

    icns_path = resources_dir / "AppIcon.icns"
    icns_ok = convert_png_to_icns(png_path, icns_path)

    plist_path = contents / "Info.plist"
    with open(plist_path, "rb") as handle:
        existing_plist = plistlib.load(handle)

    icon_file = "AppIcon" if icns_ok else "AppIcon.png"
    existing_plist.update({
        "CFBundleDisplayName": "SlackPolish",
        "CFBundleIconFile": icon_file,
        "CFBundleIconName": "AppIcon",
        "CFBundleIdentifier": "local.slackpolish.attach",
        "CFBundleName": "SlackPolish",
        "CFBundleShortVersionString": "1.0",
        "CFBundleVersion": "1",
        "LSUIElement": False,
        "NSHighResolutionCapable": True,
    })

    with open(plist_path, "wb") as handle:
        plistlib.dump(existing_plist, handle)

    apply_custom_finder_icon(str(app_path), str(png_path))
    resign_app(app_path)


def resign_app(app_path):
    """Re-sign with ad-hoc identity after modifying bundle contents (editing invalidates osacompile's signature)."""
    try:
        subprocess.run(
            ["codesign", "--force", "--deep", "--sign", "-", str(app_path)],
            check=True,
            capture_output=True,
        )
        print_verbose(f"Re-signed app bundle: {app_path}")
    except Exception as exc:
        print_warning(f"Could not re-sign app bundle: {exc}")


def create_desktop_app_link():
    desktop_app = get_desktop_app_path()
    runtime_app = get_runtime_app_path()

    legacy_alias = desktop_app.parent / f"{desktop_app.name} alias"
    for path in (desktop_app, legacy_alias):
        if path.exists() or path.is_symlink():
            if path.is_dir() and not path.is_symlink():
                shutil.rmtree(path)
            else:
                path.unlink()

    shutil.copytree(str(runtime_app), str(desktop_app))
    resign_app(desktop_app)
    print_success(f"Desktop app created: {desktop_app}")


def shell_quote(value):
    return "'" + value.replace("'", "'\"'\"'") + "'"


def install_runtime():
    runtime_root = get_runtime_root()
    current_dir = get_current_runtime_dir()

    runtime_root.mkdir(parents=True, exist_ok=True)
    copy_runtime_files(current_dir)
    write_app_wrapper(get_runtime_app_path(), current_dir)
    create_desktop_app_link()

    for legacy in (
        Path.home() / "Desktop" / "SlackPolish.command",
        Path.home() / "Desktop" / "SlackPolish-Attach.command",
        get_desktop_launch_app_path(),
    ):
        if legacy.exists() or legacy.is_symlink():
            if legacy.is_dir() and not legacy.is_symlink():
                shutil.rmtree(legacy)
            else:
                legacy.unlink()
            print_success(f"Removed legacy launcher: {legacy}")

    launcher = current_dir / "launch-slackpolish-MAC-ARM.py"
    launcher.chmod(launcher.stat().st_mode | stat.S_IXUSR)

    print_success(f"Runtime installed to: {current_dir}")
    print_success(f"Runtime app created: {get_runtime_app_path()}")
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
    print("")
    print(f"Launch SlackPolish from: {get_desktop_app_path()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
