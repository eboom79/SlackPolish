# Live Slack end-to-end suite

Runs real scenarios against the **real Slack desktop app** with SlackPolish
injected: types text into the composer of a designated conversation, fires the
real SlackPolish hotkey (a real OpenAI call), and asserts what must still be true
afterwards — regardless of how the model chose to word things.

It is intentionally **not** part of `tests/run-all-tests.js` (needs a running
Slack, the SlackPolish launcher, and your API key).

## Prerequisites

1. Slack started via `SlackPolish.app` (this exposes the DevTools port 9222 the
   suite drives, and injects SlackPolish).
2. The designated conversation open in the main pane — by default your DM with
   yourself. The composer's `aria-label` must contain `composerLabel` from
   `slack-e2e.config.json` (default `"Message to Eyal Boumgarten"`); the suite
   refuses to type anywhere else.
3. An OpenAI key configured in SlackPolish settings (F12). Not needed for
   `--dry-run`.
4. Node ≥ 22 (uses the built-in `WebSocket`).

Copy `slack-e2e.config.json` to `slack-e2e.local.json` to override locally
(git-ignored).

## Running

```bash
node tests/e2e/run-slack-e2e.mjs --list                  # scenario ids
node tests/e2e/run-slack-e2e.mjs --dry-run               # compose, read DOM, clear — no polish, no cost
node tests/e2e/run-slack-e2e.mjs                         # full run (~1 OpenAI call per scenario)
node tests/e2e/run-slack-e2e.mjs --only jira-slug-pill,quote-and-reply
node tests/e2e/run-slack-e2e.mjs --clear-first           # discard an existing draft in the composer
node tests/e2e/run-slack-e2e.mjs --keep                  # on first failure, leave the composer as-is and stop
```

Exit code 0 = all hard invariants passed. A JSON report with before/after DOM
snapshots is written to `tests/e2e/reports/` (git-ignored).

## What is asserted

**Hard invariants** (fail the scenario): polish completed with no error toast,
output not empty, no `__SLACKPOLISH_` token leaked, nothing was sent (message
count unchanged), plus per-scenario checks — URLs byte-identical, the Jira
rich-link pill (`<ts-slug>`) / anchors / `@mentions` still present and
unchanged, quote bar and list items still present, text outside a selection
untouched, no semicolons left in prose while URLs containing `;` are intact.

**Soft expectations** (reported, never fail): text actually changed, keywords
still present, greeting line kept, block count unchanged, quoted text unchanged.

## Safety

- Never dispatches a bare Enter (Slack's "send"); newlines are Shift+Enter and
  the mention autocomplete is accepted with Tab.
- Aborts before typing if the visible composer is not the configured
  conversation, if SlackPolish is not injected, or if a draft is present
  (unless `--clear-first`).
- Stops immediately if the conversation's message count changes.
- Clears the composer after every scenario (Cmd+A, Backspace).

## Adding a scenario

Edit `scenarios.mjs`: `steps` (`type`, `newline`, `paste`, `tab`, `waitFor`,
`require`, `select`), `invariants` and `expectations` built from `checks`.
Prefer structural/byte-identity checks over wording; the model's phrasing is
not deterministic.

## Chrome extension test

`node tests/e2e/chrome-extension-hotkey.mjs` launches a throwaway Chrome for
Testing (see `extension/README.md` for the one-time install) with the unpacked
extension, presses the real `Ctrl+Shift` chord over CDP and asserts the logged
event and its persistence. Independent of Slack and of the API key.
