# SlackPolish v1.4.1 Release Notes

**Release Date:** April 8, 2026  
**Build:** 1

## 🔧 macOS Launcher Hotfix

This release fixes the macOS Desktop launcher shipped in `v1.4.0`.

The runtime-based macOS architecture remains the same, but the Desktop launch
path is now based on the working symlink model:

- the real `SlackPolish.app` lives under SlackPolish Runtime in Application Support
- the Desktop `SlackPolish.app` points to that runtime app bundle
- the `.command` launchers remain available as fallback entry points

## What's Fixed

- fixed the broken macOS Desktop launcher behavior from `v1.4.0`
- added single-instance protection for the macOS runtime launcher
- fixed macOS uninstall cleanup for Desktop symlinks
- kept Slack.app untouched

## Installation

### macOS Apple Silicon
```bash
python3 installers/install-slack-MAC-ARM.py
```

After installation, use:

- `~/Desktop/SlackPolish.app`

Fallback launchers:

- `~/Desktop/SlackPolish.command`
- `~/Desktop/SlackPolish-Attach.command`

## Notes

- This is a focused macOS hotfix release
- Linux support is unchanged
- The runtime architecture introduced in `v1.4.0` remains in place
