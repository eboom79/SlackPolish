# SlackPolish Chrome extension (hotkey logger)

First step toward polishing outside Slack. For now the extension only **listens
for the SlackPolish hotkey (Ctrl+Shift) on every page and records where it was
pressed** — it does not read or change any text and makes no network calls.

Each press is logged to the page's console (`SLACKPOLISH_HOTKEY {...}`) and
persisted in `chrome.storage.local` (last 200 presses). Click the toolbar icon
to see the tally per surface and the list, and to copy it as JSON.

Recorded per press: time, surface (`atlassian` / `slack-web` / `other`), host,
path, page title, and whether an editable field was focused. The query string
is never recorded.

## Install (one time)

The installer stages a copy at
`~/Library/Application Support/SlackPolish Runtime/chrome-extension/`
(or load it straight from `extension/` in this repo).

1. Open `chrome://extensions`
2. Turn on **Developer mode** (top right)
3. **Load unpacked** → choose the folder above

After a SlackPolish update, click **Reload** on the extension card (or restart
Chrome) to pick up the new files.

## Layout

- `shared/hotkey.js` — chord detection, same semantics as the Slack script
- `shared/surface.js` — host → surface classification
- `shared/status-badge.js` — the SlackPolish status pill, copied from the Slack script
- `content/hotkey-logger.js` — content script (all URLs, top frame)
- `background.js` — persists events, updates the badge
- `popup/` — the toolbar popup

Tests: `tests/unit/test_extension_hotkey_logger.js` (unit) and
`tests/e2e/chrome-extension-hotkey.mjs` (launches a throwaway browser with the
extension loaded and presses the real chord over CDP). Google Chrome's branded
builds ignore `--load-extension`, so the live test needs **Chrome for Testing**
(or Chromium):

```bash
npx @puppeteer/browsers install chrome@stable --path ~/Library/Caches/slackpolish-browsers
node tests/e2e/chrome-extension-hotkey.mjs
```

Loading the extension unpacked in your normal Chrome (steps above) is unaffected
by that restriction.
