# JustPolish v1.7.0 Release Notes

**Release Date:** September 6, 2026
**Build:** 0

## SlackPolish is now JustPolish

The app polishes text in Slack, Jira and Confluence, so the name no longer says
"Slack". Everything else is the same: same hotkey, same prompts, same settings,
same key.

## What changed

### The name, everywhere you can see it
- The status pill reads **JustPolish Improving / JustPolish Active**
- The settings menu (F12 in Slack, the toolbar icon in Chrome) is titled
  **JustPolish Settings**
- The Chrome extension is listed as **JustPolish**
- The macOS Desktop app is **`JustPolish.app`** (with `JustPolish.command` and
  `JustPolish-Attach.command` next to it). The installer removes the old
  `SlackPolish.app`, `.command` files and runtime bundle for you
- Installer, launcher and uninstaller messages, the README and the packages
  (`JustPolish-macOS-ARM-…`, `JustPolish-Linux-…`)

### What deliberately did not change
- **Your settings and key carry over.** Storage keys, the runtime folder
  (`~/Library/Application Support/SlackPolish Runtime/`), the sync endpoint and
  all internal identifiers are unchanged, so upgrading needs no migration and
  nothing has to be re-entered
- The repository URL stays `github.com/eboom79/SlackPolish` for now

## Upgrading

### macOS Apple Silicon
```bash
python3 installers/install-slack-MAC-ARM.py
```
Then click **`JustPolish.app`** on your Desktop once (the old `SlackPolish.app`
is gone). Slack keeps running; the launcher restarts and F12 keeps working.

### Chrome extension
Click **Reload** on the extension card in `chrome://extensions`; it now shows as
JustPolish. Reload any Jira tab that was already open.

## Verification

- `node tests/run-all-tests.js`
- `node tests/e2e/chrome-extension-hotkey.mjs` (Chrome for Testing)
- `node tests/e2e/run-slack-e2e.mjs` (live Slack)
