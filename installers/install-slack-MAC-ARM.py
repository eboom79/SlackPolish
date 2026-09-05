#!/usr/bin/env python3
"""
JustPolish Installer for macOS ARM.

This installer does not modify Slack.app.
It installs the runtime launcher and JustPolish assets into the user's
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
import urllib.error
import urllib.request
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


def get_desktop_launcher_path():
    return Path.home() / "Desktop" / "JustPolish.command"


def get_desktop_attach_path():
    return Path.home() / "Desktop" / "JustPolish-Attach.command"


def get_desktop_app_path():
    return Path.home() / "Desktop" / "JustPolish.app"


def get_desktop_launch_app_path():
    return Path.home() / "Desktop" / "JustPolish Launch.app"


def get_runtime_app_path():
    return get_runtime_root() / "JustPolish.app"


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


def write_command_file(path, runtime_dir, attach_only=False, slack_app=None):
    launcher_path = runtime_dir / "launch-slackpolish-MAC-ARM.py"
    args = ["--launch-mode", "open", "-v"]
    if slack_app:
        args += ["--slack-path", str(slack_app)]
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


def convert_png_to_icns(png_path, icns_path):
    """Build a real .icns from the PNG with sips + iconutil (both ship with macOS).

    A PNG named in CFBundleIconFile is not reliably shown by Finder or the Dock,
    and setting a Finder "custom icon" via osascript needs Automation permission
    that non-interactive installs do not have. An .icns needs neither.
    """
    import tempfile
    workdir = Path(tempfile.mkdtemp(prefix="slackpolish-icon-"))
    iconset = workdir / "AppIcon.iconset"
    iconset.mkdir()
    try:
        for size in (16, 32, 128, 256, 512):
            for scale in (1, 2):
                pixels = size * scale
                name = f"icon_{size}x{size}{'@2x' if scale == 2 else ''}.png"
                subprocess.run(
                    ["sips", "-z", str(pixels), str(pixels), str(png_path), "--out", str(iconset / name)],
                    check=True, capture_output=True, text=True,
                )
        subprocess.run(["iconutil", "-c", "icns", str(iconset), "-o", str(icns_path)], check=True, capture_output=True, text=True)
        return Path(icns_path).exists()
    except Exception as exc:
        print_verbose(f"Could not build an .icns icon ({exc}); falling back to the PNG icon")
        return False
    finally:
        shutil.rmtree(workdir, ignore_errors=True)


def build_app_shell_command(runtime_dir, slack_app=None):
    launcher_path = runtime_dir / "launch-slackpolish-MAC-ARM.py"
    log_dir = Path.home() / "Library" / "Application Support" / "SlackPolish Runtime" / "mac-arm-runtime" / "state"
    log_path = log_dir / "launcher.log"
    extra = f" --slack-path {shell_quote(str(slack_app))}" if slack_app else ""
    return (
        f"mkdir -p {shell_quote(str(log_dir))} && "
        f"cd {shell_quote(str(runtime_dir))} && "
        f"nohup python3 {shell_quote(str(launcher_path))} --attach-or-relaunch --launch-mode open{extra} -v >>{shell_quote(str(log_path))} 2>&1 & "
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


def write_app_wrapper(app_path, runtime_dir, slack_app=None):
    write_jxa_app(app_path, build_app_shell_command(runtime_dir, slack_app=slack_app))

    contents = app_path / "Contents"
    resources_dir = contents / "Resources"
    resources_dir.mkdir(parents=True, exist_ok=True)

    icon_path = resources_dir / "AppIcon.png"
    icon_path.write_bytes(load_app_icon_png_bytes())
    icns_path = resources_dir / "AppIcon.icns"
    has_icns = convert_png_to_icns(icon_path, icns_path)

    plist_path = contents / "Info.plist"
    with open(plist_path, "rb") as handle:
        existing_plist = plistlib.load(handle)

    existing_plist.update({
        "CFBundleDisplayName": "JustPolish",
        "CFBundleIconFile": "AppIcon" if has_icns else "AppIcon.png",
        "CFBundleIconName": "AppIcon",
        "CFBundleIdentifier": "local.slackpolish.attach",
        "CFBundleName": "JustPolish",
        "CFBundleShortVersionString": "1.0",
        "CFBundleVersion": "1",
        "LSUIElement": False,
        "NSHighResolutionCapable": True,
    })

    with open(plist_path, "wb") as handle:
        plistlib.dump(existing_plist, handle)

    # Nudge Finder/LaunchServices to re-read the bundle's icon
    os.utime(app_path, None)


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

    desktop_app.symlink_to(runtime_app)
    print_success(f"Desktop app link created: {desktop_app} -> {runtime_app}")


def shell_quote(value):
    return "'" + value.replace("'", "'\"'\"'") + "'"


DEFAULT_DEBUG_PORT = 9222


def check_remote_debugging(port=DEFAULT_DEBUG_PORT, timeout=1.0):
    """Return True if a Chrome DevTools endpoint answers on 127.0.0.1:<port>.

    This is the only reliable test of whether Slack honours
    --remote-debugging-port. Inspecting Electron fuse bytes is not: Slack
    4.52.155 exposes the port with EnableNodeCliInspectArguments OFF.
    """
    try:
        with urllib.request.urlopen(f"http://127.0.0.1:{port}/json/version", timeout=timeout) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, OSError, ValueError):
        return False
    return isinstance(payload, dict) and ("webSocketDebuggerUrl" in payload or "Browser" in payload)


def _report_remote_debugging(slack_app, port=DEFAULT_DEBUG_PORT):
    """Tell the user whether remote debugging is verified; never gate the install on fuse bytes."""
    if check_remote_debugging(port):
        print_success(
            f"Slack DevTools endpoint is reachable on 127.0.0.1:{port} — remote debugging works; "
            "no Electron patch is needed."
        )
        return
    print_info(
        f"Slack is not currently running with the JustPolish debug port ({port}). "
        "The launcher starts Slack with --remote-debugging-port and verifies on first run."
    )
    print_info(
        "If the launcher later reports it cannot attach, inspect the Electron fuses with:\n"
        f"  python3 {SCRIPT_DIR / 'patch-electron-fuse-MAC-ARM.py'} --check --slack-app {slack_app}"
    )


def _slack_version(app_path):
    """Return the CFBundleShortVersionString of Slack.app, or None."""
    try:
        import plistlib
        plist_path = app_path / "Contents" / "Info.plist"
        with open(plist_path, "rb") as handle:
            plist = plistlib.load(handle)
        return plist.get("CFBundleShortVersionString")
    except Exception:
        return None


def _sync_slack_copy(source_app, dest_app):
    """Copy source_app to dest_app if it is missing or outdated."""
    source_ver = _slack_version(source_app)
    dest_ver = _slack_version(dest_app) if dest_app.exists() else None

    if dest_ver and dest_ver == source_ver:
        print_verbose(f"User Slack copy is already version {dest_ver} — skipping copy.")
        return

    if dest_app.exists():
        print_info(f"Updating user Slack copy from {dest_ver} to {source_ver}...")
        shutil.rmtree(dest_app)
    else:
        print_info(f"Creating user Slack copy (version {source_ver})...")

    dest_app.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(source_app, dest_app, symlinks=True)
    print_success(f"Copied Slack.app → {dest_app}")


def get_extension_dir():
    return Path.home() / "Library" / "Application Support" / "SlackPolish Runtime" / "chrome-extension"


def stage_chrome_extension():
    """Copy the Chrome extension next to the runtime so it can be loaded unpacked from a stable path."""
    source = REPO_ROOT / "extension"
    if not (source / "manifest.json").exists():
        print_verbose("No extension/ directory in this checkout - skipping the Chrome extension.")
        return None
    destination = get_extension_dir()
    if destination.exists():
        shutil.rmtree(destination)
    shutil.copytree(source, destination)
    # The extension loads slack-config.js (prompts, styles, languages, model) from a vendored copy: keep it current
    (destination / "vendor").mkdir(exist_ok=True)
    shutil.copy2(REPO_ROOT / "slack-config.js", destination / "vendor" / "slack-config.js")
    print_success(f"Chrome extension staged at: {destination}")
    return destination


def install_runtime(slack_app=None):
    runtime_root = get_runtime_root()
    current_dir = get_current_runtime_dir()

    runtime_root.mkdir(parents=True, exist_ok=True)
    copy_runtime_files(current_dir)
    write_command_file(get_desktop_launcher_path(), current_dir, attach_only=False, slack_app=slack_app)
    write_command_file(get_desktop_attach_path(), current_dir, attach_only=True, slack_app=slack_app)
    write_app_wrapper(get_runtime_app_path(), current_dir, slack_app=slack_app)
    create_desktop_app_link()

    legacy_launch_app = get_desktop_launch_app_path()
    if legacy_launch_app.exists():
        shutil.rmtree(legacy_launch_app)
        print_success(f"Removed legacy Desktop launch app: {legacy_launch_app}")

    # Pre-1.7 installs were called SlackPolish: drop the old Desktop entries and runtime bundle
    desktop = Path.home() / "Desktop"
    for legacy in (desktop / "SlackPolish.app", desktop / "SlackPolish.app alias", desktop / "SlackPolish.command", desktop / "SlackPolish-Attach.command", runtime_root / "SlackPolish.app"):
        if legacy.is_symlink() or legacy.is_file():
            legacy.unlink()
            print_success(f"Removed old SlackPolish item: {legacy}")
        elif legacy.is_dir():
            shutil.rmtree(legacy)
            print_success(f"Removed old SlackPolish bundle: {legacy}")

    launcher = current_dir / "launch-slackpolish-MAC-ARM.py"
    launcher.chmod(launcher.stat().st_mode | stat.S_IXUSR)

    print_success(f"Runtime installed to: {current_dir}")
    print_success(f"Desktop launcher created: {get_desktop_launcher_path()}")
    print_success(f"Desktop attach launcher created: {get_desktop_attach_path()}")
    print_success(f"Runtime app created: {get_runtime_app_path()}")
    return current_dir


def parse_args():
    parser = argparse.ArgumentParser(description="Install JustPolish runtime launcher for macOS ARM")
    parser.add_argument("-v", "--verbose", action="store_true", help="Enable verbose output")
    return parser.parse_args()


def main():
    global VERBOSE
    args = parse_args()
    VERBOSE = args.verbose

    print_header("🍎 JustPolish Runtime Installer for macOS ARM")

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

    if slack_app:
        _report_remote_debugging(slack_app)

    print_info("Installing JustPolish runtime launcher...")
    runtime_dir = install_runtime(slack_app=slack_app)

    print_header("✅ Installation Completed")
    print(f"Runtime files: {runtime_dir}")
    print(f"Launch JustPolish from: {get_desktop_launcher_path()}")
    print("")
    print("Recommended use:")
    print(f"  {get_desktop_app_path()}")
    print("")
    print("Alternative launchers:")
    print(f"  Smart attach-or-launch app: {get_desktop_app_path()}")
    print(f"  Launch Slack with JustPolish: {get_desktop_launcher_path()}")
    print(f"  Attach to already-running Slack: {get_desktop_attach_path()}")

    extension_dir = stage_chrome_extension()
    if extension_dir:
        print("")
        print("Chrome extension (polishes Jira/Confluence comments with the key saved in Slack):")
        print("  One time: open chrome://extensions, enable Developer mode, click 'Load unpacked' and choose:")
        print(f"    {extension_dir}")
        print("  After updates: click 'Reload' on the extension card (or restart Chrome).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
