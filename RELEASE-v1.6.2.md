# SlackPolish v1.6.2 Release Notes

**Release Date:** September 5, 2026
**Build:** 2

## Your message comes back structurally intact

Polishing now leaves everything that is not your own prose exactly as it was, and
restores structure the model tends to lose.

## What's New

### Content that is never rewritten
- **Quotes** (`>` lines) keep their quote bar, and the quoted words come back
  byte-identical — they are someone else's words. The model still sees them as
  context so your reply is polished with awareness of what it answers
- **Links** stay byte-identical: bare URLs (including query strings, `#fragments`
  and `;` inside URLs), Slack link pills, and **Jira / Google Drive / Confluence
  rich-link pills** (`<ts-slug>`), which were previously flattened to their title
  with the URL lost
- **Inline code** (`` `npm test` ``) and **code blocks** (```) are preserved verbatim
  and stay code
- **Emoji** typed as `:tada:` are no longer silently deleted
- **@mentions** and **#channel** pills survive (also inside quotes)
- A link or mention the model drops is put back rather than lost

### Structure the model tends to lose
- **Bold / italic / strikethrough** are re-applied when the model keeps the words
- A **deliberate blank line** between paragraphs is preserved (Tone Polish now only
  removes blank lines the model *adds*)
- If the model merges lines, SlackPolish asks once more with the exact line count
- Slack's fast-typing race that splits a link (`…/kee` + stray `p`) no longer
  costs you a character

### Selection mode
- Selecting part of a message and polishing now truly touches only the selection,
  and links/quotes/mentions outside it are preserved even when the selection
  range has to be reconstructed. Errors leave the message unchanged instead of
  replacing it with the selected text
- Messages that contain only links, pills, code or quoted text show
  **"Nothing to polish"** and make no API call (a link-only message used to come
  back with invented prose)

### macOS launcher and installer
- Clicking `SlackPolish.app` while it is already running now replaces the running
  launcher (it used to crash with "Address already in use" and silently keep the
  old code)
- The launcher only stops processes actually running the launcher script — no more
  killing an editor, `grep` or a shell that merely mentions the file
- The installer checks the live DevTools endpoint instead of an Electron fuse byte
  and no longer asks you to `sudo` patch Slack.app. **The fuse patch recommended in
  the v1.6.0 notes is not needed on Slack 4.52+**; `patch-electron-fuse-MAC-ARM.py`
  remains as a troubleshooting tool and now handles both architecture slices with
  the correct fuse names
- `SlackPolish.app` ships a real `.icns`, so the icon shows in Finder and the Dock
  without the Finder-permission warning
- The version shown in settings now matches the release (1.6.0/1.6.1 reported 1.5.5)

### For developers
- New **live Slack end-to-end suite** (`tests/e2e`, see its README): drives the real
  Slack app through the launcher's DevTools port, fires the real hotkey and asserts
  invariants that hold regardless of the model's wording. It found most of the bugs
  above
- CI runs on current GitHub Actions majors and Node 22

## Installation

### macOS Apple Silicon
```bash
python3 installers/install-slack-MAC-ARM.py
```

Then launch (or re-launch) from `~/Desktop/SlackPolish.app`. No `sudo` step is
required.

## Verification

- `node tests/run-all-tests.js --exclude-chaos --exclude-vectors`
- `node tests/vector/test_text_processing_vectors.js`
- `node tests/vector/test_config_processing_vectors.js`
- `node tests/chaos/test_text_processing_chaos.js`
- `node tests/chaos/test_config_processing_chaos.js`
- `node tests/e2e/run-slack-e2e.mjs` (live Slack; requires the launcher and an API key)

## Notes

- If you followed the v1.6.0 instructions and patched the Electron fuse, nothing
  needs to be undone; the patch is simply no longer required after Slack updates
- `~/Applications/Slack.app`, if present from pre-1.6.0 installs, is unused and can
  be deleted
