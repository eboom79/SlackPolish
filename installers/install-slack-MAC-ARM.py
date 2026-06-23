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


def get_desktop_launcher_path():
    return Path.home() / "Desktop" / "SlackPolish.command"


def get_desktop_attach_path():
    return Path.home() / "Desktop" / "SlackPolish-Attach.command"


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

    plist_path = contents / "Info.plist"
    with open(plist_path, "rb") as handle:
        existing_plist = plistlib.load(handle)

    existing_plist.update({
        "CFBundleDisplayName": "SlackPolish",
        "CFBundleIconFile": "AppIcon.png",
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

    apply_custom_finder_icon(str(app_path), str(icon_path))


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


def _load_fuse_patcher():
    """Dynamically import the fuse patcher module."""
    import importlib.util
    fuse_patcher = SCRIPT_DIR / "patch-electron-fuse-MAC-ARM.py"
    if not fuse_patcher.exists():
        return None
    spec = importlib.util.spec_from_file_location("fuse_patcher", fuse_patcher)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def _ensure_patched_slack_app(slack_app):
    """
    Ensure the Electron fuse that allows --remote-debugging-port is enabled.

    Slack 4.45+ ships Electron with EnableNodeCliInspectArguments = OFF, which
    silently ignores --remote-debugging-port.

    Strategy: patch /Applications/Slack.app in-place via sudo (preserves the
    original code signature identity so macOS network access is unaffected).
    A user copy in ~/Applications is no longer created — it caused macOS to
    treat the re-signed binary as an untrusted app and block network requests.

    Returns the Path of the Slack.app SlackPolish should launch.
    """
    mod = _load_fuse_patcher()
    if mod is None:
        print_warning("Fuse patcher script not found — skipping fuse check.")
        return slack_app

    patch_needed = mod.needs_patch(slack_app)
    if patch_needed is None:
        print_warning("Could not determine Electron fuse state — skipping fuse patch.")
        return slack_app

    if not patch_needed:
        print_success("Electron fuse EnableNodeCliInspectArguments is already ON — no patch needed.")
        return slack_app

    # Try patching in-place (works if we own the file or have sudo).
    print_info(
        "Slack 4.45+ ships Electron with remote-debugging disabled via a fuse. "
        f"Patching {slack_app} in-place (you may be prompted for your password)..."
    )
    ok = mod.patch_fuse(slack_app)
    if ok:
        print_success("Electron fuse patched — SlackPolish can now attach to Slack.")
    else:
        print_warning(
            "Fuse patch failed. Run manually with sudo:\n"
            f"  sudo python3 {SCRIPT_DIR / 'patch-electron-fuse-MAC-ARM.py'} "
            f"--slack-app {slack_app}"
        )
    return slack_app


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

    launcher = current_dir / "launch-slackpolish-MAC-ARM.py"
    launcher.chmod(launcher.stat().st_mode | stat.S_IXUSR)

    print_success(f"Runtime installed to: {current_dir}")
    print_success(f"Desktop launcher created: {get_desktop_launcher_path()}")
    print_success(f"Desktop attach launcher created: {get_desktop_attach_path()}")
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

    # Ensure a patched Slack copy exists and get the path SlackPolish should launch.
    launch_app = _ensure_patched_slack_app(slack_app) if slack_app else None

    print_info("Installing SlackPolish runtime launcher...")
    runtime_dir = install_runtime(slack_app=launch_app)

    print_header("✅ Installation Completed")
    print(f"Runtime files: {runtime_dir}")
    print(f"Launch SlackPolish from: {get_desktop_launcher_path()}")
    print("")
    print("Recommended use:")
    print(f"  {get_desktop_app_path()}")
    print("")
    print("Alternative launchers:")
    print(f"  Smart attach-or-launch app: {get_desktop_app_path()}")
    print(f"  Launch Slack with SlackPolish: {get_desktop_launcher_path()}")
    print(f"  Attach to already-running Slack: {get_desktop_attach_path()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
