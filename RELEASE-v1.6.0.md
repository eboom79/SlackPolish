# SlackPolish v1.6.0 Release Notes

**Release Date:** June 23, 2026
**Build:** 0

## Slack 4.50 / Electron 42 Compatibility

Slack 4.50 introduced breaking changes that prevented SlackPolish from attaching. This release fully restores compatibility on macOS Apple Silicon.

## What's New

- **Electron fuse re-enabled** — Slack 4.50 ships with `EnableNodeCliInspectArguments` turned off, silently ignoring `--remote-debugging-port`. A new `installers/patch-electron-fuse-MAC-ARM.py` applies a one-byte patch to `/Applications/Slack.app` to re-enable it (a backup of the original `Electron Framework` is kept)
- **CORS bypass for OpenAI** — Electron 42's renderer cannot make cross-origin requests to `api.openai.com` from injected scripts. All API calls now route through a local Python proxy (port 9224) inside the launcher process
- **Graceful Slack quit** — Slack was previously force-killed on relaunch, which prevented Electron from flushing `localStorage` and lost user settings. The launcher now quits Slack via AppleScript before relaunching
- **Launcher always replaced** — clicking `SlackPolish.app` previously reused a stale launcher process with outdated code. New launches now always replace the previous instance
- **Startup network retry** — transient "Failed to fetch" errors on startup are retried instead of surfacing to the user
- **In-place patching** — SlackPolish now patches `/Applications/Slack.app` directly instead of maintaining a separate copy under `~/Applications`

## User Impact

SlackPolish attaches to Slack 4.50+ again, API calls succeed from the injected script, and settings survive a relaunch.

## Installation

### macOS Apple Silicon
```bash
python3 installers/install-slack-MAC-ARM.py
```

Then apply the one-time Electron fuse patch (required again after any Slack update):
```bash
sudo python3 installers/patch-electron-fuse-MAC-ARM.py --slack-app /Applications/Slack.app
```

After installation, use `~/Desktop/SlackPolish.app`.

## Verification

- `node tests/run-all-tests.js --exclude-chaos --exclude-vectors`
- `node tests/vector/test_text_processing_vectors.js`
- `node tests/vector/test_config_processing_vectors.js`
- `node tests/chaos/test_text_processing_chaos.js`
- `node tests/chaos/test_config_processing_chaos.js`

## Notes

- If Slack auto-updates, re-run the fuse patch command above
- The `~/Applications/Slack.app` copy created by earlier versions is no longer used and can be deleted
