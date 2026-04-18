# SlackPolish v1.5.2 Release Notes

**Release Date:** April 18, 2026  
**Build:** 2

## Human Voice Tuning & Launcher Recovery

This release makes SlackPolish sound less like a generic AI rewrite and improves macOS recovery when the runtime launcher gets into a bad state.

## What's New

- reworked `TONE_POLISH` to preserve the original writer voice with smaller, more conservative edits
- added explicit prompt guardrails against polished AI phrasing, corporate speak, and over-smoothed language
- lowered text-improvement temperature to reduce generic ChatGPT-style Slack output
- added macOS launcher health/status files for easier troubleshooting
- added persistent macOS launcher logs
- added stale-launcher recovery and duplicate-launcher cleanup on startup

## User Impact

SlackPolish should now:

- keep more of the original human cadence and wording in Slack messages
- avoid turning short or casual messages into polished assistant-style text
- recover more reliably when `SlackPolish.app` is clicked after the launcher gets stuck
- leave behind usable runtime logs instead of failing silently

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

- `node tests/unit/test_tone_polish_mode.js`
- `node tests/unit/test-tone-polish-human-voice.js`
- `python3 installers/install-slack-MAC-ARM.py`

## Notes

- `Slack.app` is still left untouched on macOS
- existing SlackPolish features remain available on Linux
