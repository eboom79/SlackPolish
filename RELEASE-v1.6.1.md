# SlackPolish v1.6.1 Release Notes

**Release Date:** June 25, 2026
**Build:** 1

## Fix Prompt Confusion with Smart Context

When the conversation context contained a recent message from the same user with technical content, the model would sometimes polish that context message instead of the actual input text.

## What's New

- the prompt now wraps the text-to-improve in explicit `=== MESSAGE TO IMPROVE ===` markers, making it unambiguous which text the model should polish regardless of what appears in the Smart Context block

## User Impact

Polished output always corresponds to the text you typed, even when recent channel history contains similar-looking content from you.

## Installation

### macOS Apple Silicon
```bash
python3 installers/install-slack-MAC-ARM.py
```

If upgrading from a version earlier than v1.6.0, also apply the one-time Electron fuse patch:
```bash
sudo python3 installers/patch-electron-fuse-MAC-ARM.py --slack-app /Applications/Slack.app
```

## Verification

- `node tests/run-all-tests.js --exclude-chaos --exclude-vectors`
- `node tests/vector/test_text_processing_vectors.js`
- `node tests/vector/test_config_processing_vectors.js`
- `node tests/chaos/test_text_processing_chaos.js`
- `node tests/chaos/test_config_processing_chaos.js`
