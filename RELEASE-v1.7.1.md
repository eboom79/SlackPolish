# JustPolish v1.7.1 Release Notes

**Release Date:** October 25, 2026
**Build:** 1

## Polishing works again after OpenAI retired gpt-4-turbo

On October 23, 2026 OpenAI retired `gpt-4-turbo`, the model JustPolish had used
since the beginning. Every polish failed with "The model has been deprecated".
This release moves to a current model and makes sure a retirement can never stop
a polish again.

## What changed

### New default model and a fallback chain
- Default: **`gpt-5.4-mini`** — current generation, about one second per polish,
  minimal edits, no announced retirement. Verified with a token-protected polishing
  prompt (mentions, links, quote lines and line structure intact) and the full live
  Slack suite
- Fallbacks, tried in order when OpenAI reports a model as retired:
  `gpt-5.4` → `gpt-5.1` (retires 2027-04-01) → `gpt-4.1` (retires 2027-01-14)
- Both are plain settings in `slack-config.js` (`OPENAI_MODEL`,
  `OPENAI_MODEL_FALLBACKS`) if you prefer a different model, for example the larger
  `gpt-5.4`

### A client that survives retirements
- When the configured model answers "model not found", the next model in the chain
  is used, the retired one is remembered so later polishes skip it, and you are told
  once which model took over
- Newer models take a different request shape (`max_completion_tokens` instead of
  `max_tokens`; some accept only the default temperature). The client adapts the
  request and retries the same model instead of failing
- Text improvement, the **Test API Key** button, **channel summaries** and the
  **Chrome extension** all use the same client, in Slack and in Jira/Confluence

### Fixes found on the way
- Restarting the launcher while Slack stays open now replaces the OpenAI module in
  the live page too (the old one survived re-injection and kept the old request
  shape)
- The live Slack end-to-end helper library (`tests/e2e/lib/`) is now in the
  repository; a blanket `lib/` rule in `.gitignore` had hidden it since v1.6.2

## Upgrading

### macOS Apple Silicon
```bash
python3 installers/install-slack-MAC-ARM.py
```
Then click `JustPolish.app` once. Slack keeps running; the launcher restarts and
the new client is injected into the open Slack window.

### Chrome extension
Click **Reload** on the JustPolish card in `chrome://extensions`, then reload any
Jira tab that was already open.

## Verification

- `node tests/run-all-tests.js` (46/46; includes `tests/unit/test_model_fallback.js`)
- `node tests/e2e/chrome-extension-hotkey.mjs` (63/63, Chrome for Testing; mock
  OpenAI plays a retired model and a temperature-locked model)
- `node tests/e2e/run-slack-e2e.mjs` (live Slack, real model: 29 PASS, 1 expected SKIP)
