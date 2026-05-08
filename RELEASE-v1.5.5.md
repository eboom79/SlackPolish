# SlackPolish v1.5.5 Release Notes

**Release Date:** May 8, 2026
**Build:** 5

## Smart Context Active by Default

This release activates Smart Context across all polishing styles and fixes a class of mention-handling bugs that could leak placeholder tokens into the composer.

## What's New

- `SMART_CONTEXT.enabled` defaults to `true` — text improvements now use the recent conversation by default
- removed the prompt directive that told the model to ignore the conversation context block; replaced with positive guidance to use it for intent and tone only
- removed the Tone Polish skip — Smart Context now applies to all styles
- recognized `<ts-mention>` elements and the `member_slug` className family as mentions (previously misclassified as links by the entity extractor)
- wired `SMART_CONTEXT.messageCount` (1..10, default 5) end to end, replacing four hardcoded `5`s
- wired `SMART_CONTEXT.enableForGreetings` so pure-greeting drafts (`hi`, `thanks`, `ok`, etc.) skip context unless explicitly opted in
- removed the unused `minTextLength` config knob (was documented but never read)
- updated `test_smart_context.js` to match the new message-count wiring

## User Impact

SlackPolish should now:

- produce more context-aware rewrites without any user toggle required
- handle `@mentions` correctly through the round trip (token → LLM → DOM clone) on the macOS runtime
- avoid using context on bare greetings that previously risked context bleed
- expose a working `messageCount` setting for users who want more or fewer context messages

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

- `node tests/run-all-tests.js --exclude-chaos --exclude-vectors`
- `node tests/vector/test_text_processing_vectors.js`
- `node tests/vector/test_config_processing_vectors.js`
- `node tests/chaos/test_text_processing_chaos.js`
- `node tests/chaos/test_config_processing_chaos.js`

## Notes

- `Slack.app` is still left untouched on macOS
- existing users who toggled Smart Context off in settings will keep that preference; the new default only applies to fresh installs or users who never opened the settings panel
