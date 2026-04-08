# SlackPolish v1.4.2 Release Notes

**Release Date:** April 8, 2026  
**Build:** 2

## macOS Channel Summary Support

This release adds channel summary support to the working macOS runtime-launcher path.

The macOS launcher model remains the same as `v1.4.1`:

- the real `SlackPolish.app` lives under SlackPolish Runtime in Application Support
- the Desktop `SlackPolish.app` points to that runtime app bundle
- the `.command` launchers remain available as fallback entry points

## What's New

- added `slack-channel-summary.js` to the macOS runtime payload
- added `slack-channel-summary.js` to the macOS package contents
- updated macOS runtime documentation to reflect summary support
- kept the working symlink-based macOS launcher model
- kept single-instance protection in the macOS runtime launcher

## macOS User Impact

macOS users now get:

- text improver
- settings
- channel summary

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

- This is a focused macOS follow-up release
- Linux support is unchanged
- Slack.app remains untouched
