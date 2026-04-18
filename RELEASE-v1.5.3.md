# SlackPolish v1.5.3 Release Notes

**Release Date:** April 18, 2026  
**Build:** 3

## Entity Preservation & Simpler Status UI

This release focuses on preserving real Slack entities during polishing and simplifying the in-Slack feedback UI.

## What's New

- preserved real Slack `@mentions` during full-message polishing
- preserved Slack link entities instead of flattening them to plain text
- added protected-entity extraction and restoration for mentions and links
- added prompt guardrails to stop inventing greetings or openers like `Hey,` when they were not in the original message
- removed the upper-right blue loading toast and kept the bottom-left runtime badge as the single visible status indicator
- improved macOS runtime reinjection so updated builds replace stale in-page SlackPolish code more reliably

## User Impact

SlackPolish should now:

- keep Slack mentions clickable and real after polishing
- keep Slack links as links instead of plain text in the common full-message flow
- avoid unnecessary greeting additions at the start of rewritten messages
- show one clearer status indicator instead of two competing ones during text improvement

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

- `node tests/unit/test_link_preservation.js`
- `node tests/unit/test_mention_preservation.js`
- `node tests/unit/test_protected_entity_wiring.js`
- `node tests/unit/test_ui_elements.js`
- `node tests/unit/test_branding_integration.js`

## Notes

- `Slack.app` is still left untouched on macOS
- the entity-preservation work is strongest in the full-message polishing path
