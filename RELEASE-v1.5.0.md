# SlackPolish v1.5.0 Release Notes

**Release Date:** April 9, 2026  
**Build:** 0

## English Language Variants & Improved macOS Launcher

This release introduces American English (USA) and British English (UK) as separate language options, plus critical macOS launcher path detection improvements.

## What's New

### 🌍 English Language Variants

- **American English (USA)** 🇺🇸 - Default option with American English expressions
- **British English (UK)** 🇬🇧 - British English spelling and expressions
- **TONE_POLISH Adaptation** - Automatically adjusts to match selected English variant
  - Becomes "sound like a native American English speaker" for USA
  - Becomes "sound like a native British English speaker" for UK

### 🔧 macOS Launcher Improvements

- **Smart Path Detection** - Launcher auto-detects whether running from source or runtime directory
- **Fixed DevTools Integration** - Corrects file path resolution for macOS runtime injection
- **Robust Fallback Logic** - Checks local directory first, falls back to repository root

## Technical Changes

### Configuration (`slack-config.js`)
- Split single `ENGLISH` option into `ENGLISH_USA` and `ENGLISH_UK`
- Added 🇬🇧 flag for British English option
- Updated TONE_POLISH prompt to be language-neutral as base

### Text Improver (`slack-text-improver.js`)
- Updated language mapping to include both English variants
- Default language set to "English (USA)" for backward compatibility
- Dynamic TONE_POLISH prompt that adapts based on selected English variant
- Smart substitution: "native English speaker" → "native American/British English speaker"

### Settings Interface (`slack-settings.js`)
- Updated language dropdown to show both English variants with appropriate flags
- Fallback language options include new variants

### macOS Launcher (`launch-slackpolish-MAC-ARM.py`)
- Added `FILE_DIR` variable for intelligent path detection
- Checks for slack-*.js files in current directory first (runtime)
- Falls back to REPO_ROOT for source directory (CLI execution)
- Fixes FileNotFoundError when launcher runs from runtime directory

## User Impact

### For All Users
- F12 settings menu now shows English (USA) and English (UK) as separate options
- Tone Polish style adapts to the selected English variant
- Users can choose their preferred English dialect

### For macOS Users
- Launcher no longer fails with "Missing required SlackPolish files" error
- Attach command (`SlackPolish-Attach.command`) now works reliably
- DevTools injection succeeds on first try

## Installation & Usage

### macOS Apple Silicon
```bash
python3 installers/install-slack-MAC-ARM.py
```

### Using English Variants

1. **Launch SlackPolish**
   ```bash
   ~/Desktop/SlackPolish.app
   ```

2. **Open Settings** with F12

3. **Select Language**
   - English (USA) 🇺🇸 for American English
   - English (UK) 🇬🇧 for British English

4. **Use Tone Polish** with Ctrl+Shift to see dialect-specific improvements

## Backward Compatibility

- Default language remains English (USA) - existing users see familiar behavior
- All existing features (text improvement, settings, channel summary) work unchanged
- No breaking changes to API or configuration format

## Testing

- ✅ English (USA) language variant with Tone Polish
- ✅ English (UK) language variant with Tone Polish
- ✅ Settings persistence across sessions
- ✅ macOS launcher path detection from both source and runtime
- ✅ All existing text improvement styles and languages supported

## Known Issues

None at this time.

## Next Steps

Plan for future releases:
- Additional language variant support (Australian English, etc.)
- Enhanced dialect-specific prompt optimization
- User preference savings across app restarts
