#!/usr/bin/env python3
"""
SlackPolish Uninstaller for macOS ARM.

Removes the runtime launcher installation created by the macOS runtime installer.
It does not modify Slack.app.
"""

import argparse
import os
import shutil
import signal
import subprocess
import sys
from pathlib import Path


GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
BLUE = "\033[94m"
RESET = "\033[0m"


def print_error(message):
    print(f"{RED}❌ {message}{RESET}")


def print_success(message):
    print(f"{GREEN}✅ {message}{RESET}")


def print_warning(message):
    print(f"{YELLOW}⚠️ {message}{RESET}")


def print_info(message):
    print(f"{BLUE}🔍 {message}{RESET}")


def print_header(message):
    print(f"\n{BLUE}{'=' * 50}")
    print(message)
    print(f"{'=' * 50}{RESET}\n")


def get_runtime_root():
    return Path.home() / "Library" / "Application Support" / "SlackPolish Runtime" / "mac-arm-runtime"


def get_runtime_app_path():
    return get_runtime_root() / "SlackPolish.app"


def get_launcher_paths():
    desktop = Path.home() / "Desktop"
    return [
        desktop / "SlackPolish.command",
        desktop / "SlackPolish-Attach.command",
        desktop / "SlackPolish.app",
        desktop / "SlackPolish Launch.app",
    ]


def terminate_running_launchers():
    script_name = "launch-slackpolish-MAC-ARM.py"
    try:
        result = subprocess.run(
            ["pgrep", "-f", script_name],
            capture_output=True,
            text=True,
            check=False,
        )
    except Exception as exc:
        print_warning(f"Could not inspect running SlackPolish launchers: {exc}")
        return

    pids = []
    for line in result.stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            pid = int(line)
        except ValueError:
            continue
        if pid != os.getpid():
            pids.append(pid)

    if not pids:
        return

    for pid in pids:
        try:
            signal.kill(pid, signal.SIGTERM)
            print_success(f"Stopped running SlackPolish launcher process: {pid}")
        except ProcessLookupError:
            continue
        except Exception as exc:
            print_warning(f"Could not stop launcher process {pid}: {exc}")


def remove_path(path):
    if not path.exists() and not path.is_symlink():
        return False
    if path.is_dir() and not path.is_symlink():
        shutil.rmtree(path)
    else:
        path.unlink()
    return True


def remove_empty_parents(path, stop_at):
    current = path
    while current != stop_at and current.exists():
        try:
            current.rmdir()
        except OSError:
            break
        current = current.parent


def parse_args():
    parser = argparse.ArgumentParser(description="Uninstall SlackPolish runtime launcher for macOS ARM")
    parser.add_argument("--keep-launchers", action="store_true", help="Do not remove Desktop launchers and app wrappers")
    return parser.parse_args()


def main():
    args = parse_args()

    print_header("🗑️ SlackPolish Runtime Uninstaller for macOS ARM")
    print_info("Removing SlackPolish runtime files without modifying Slack.app...")

    terminate_running_launchers()

    runtime_root = get_runtime_root()
    if remove_path(runtime_root):
        print_success(f"Removed runtime directory: {runtime_root}")
        remove_empty_parents(runtime_root.parent, Path.home())
    else:
        print_warning(f"Runtime directory not found: {runtime_root}")

    runtime_app = get_runtime_app_path()
    if remove_path(runtime_app):
        print_success(f"Removed runtime app: {runtime_app}")

    if args.keep_launchers:
        print_info("Keeping Desktop launcher files as requested")
    else:
        removed_any = False
        for launcher in get_launcher_paths():
            if remove_path(launcher):
                removed_any = True
                print_success(f"Removed launcher: {launcher}")
        if not removed_any:
            print_warning("No Desktop launcher files were found")

    print_header("✅ Uninstallation Completed")
    print("Slack.app was not modified.")
    print("If Slack is open, quit and relaunch it normally from Applications.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
