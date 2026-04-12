# SlackPolish v1.5.1 Release Notes

**Release Date:** April 12, 2026  
**Build:** 1

## macOS Launcher Reliability & Runtime Status

This release focuses on making the macOS runtime launcher far more reliable and easier to verify in day-to-day use.

## What's New

- fixed `SlackPolish.app` so the Desktop app wrapper actually launches the runtime correctly
- added smart attach-or-relaunch behavior when Slack is already open without SlackPolish attached
- moved the macOS single-instance lock file to `/tmp` to avoid launcher startup failures
- improved startup fallback behavior so Slack relaunches faster instead of appearing idle
- added an in-Slack runtime badge that shows:
  - `SlackPolish Active`
  - `SlackPolish Improving`
  - an attention state for API/runtime issues

## User Impact

macOS users should now see:

- more reliable SlackPolish startup from `~/Desktop/SlackPolish.app`
- better recovery when Slack is already running normally
- a visible in-Slack indicator confirming that SlackPolish is actually attached

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

## Verification

- `node --check slack-text-improver.js`
- `node tests/unit/test_ui_elements.js`
- `python3 installers/install-slack-MAC-ARM.py`

## Notes

- `Slack.app` is still left untouched on macOS
- Linux behavior is unchanged in this release
