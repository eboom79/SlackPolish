# SlackPolish v1.3.0 Release Notes

**Release Date:** January 31, 2026  
**Build:** 62

## 🎉 Major Update: Slack v4.47.69 Support

This release adds support for the latest Slack desktop version (v4.47.69) with a completely rewritten injection method.

---

## ✨ What's New

### **Slack v4.47.69 Compatibility**
- ✅ Fixed injection method to work with new Slack file structure
- ✅ Proper handling of sourcemap comments in minified JavaScript
- ✅ Improved injection positioning to avoid breaking Slack's IIFE closures

### **Improved Stability**
- ✅ Fixed hotkey issues when pressing Ctrl+Shift very quickly (< 50ms)
- ✅ Removed debounce timeout that was preventing fast key presses
- ✅ Better event listener management with proper cleanup
- ✅ Native browser key state tracking instead of manual state management

### **Bug Fixes**
- ✅ Fixed duplicate injection markers in script files
- ✅ Fixed missing newlines at end of script files
- ✅ Fixed logo display in settings interface
- ✅ Restored original SlackPolish logo (2.1MB)

---

## 🔧 Technical Changes

### **Injection Method Overhaul**
- Rewrote installer to inject code BEFORE the closing IIFE and sourcemap comment
- Fixed file structure corruption issues that caused syntax errors
- Improved cleanup patterns to remove old SlackPolish code

### **Hotkey System Improvements**
- Use native `event.ctrlKey`, `event.shiftKey`, `event.altKey` properties
- Immediate trigger with async IIFE pattern instead of debounce timeout
- Added `hotkeyPressedOnce` flag to prevent duplicate triggers
- Added focus/blur listeners to clear stuck key states

### **File Structure Fixes**
- Added proper newlines at end of all script files
- Removed duplicate injection markers from individual scripts
- Fixed whitespace preservation between code and sourcemap

---

## ⚠️ Known Issues

### **Channel Summary Temporarily Disabled**
The channel summary feature (F10) has been temporarily disabled due to compatibility issues with the new Slack version. This will be fixed in a future release.

**Working Features:**
- ✅ Text Improvement (Ctrl+Shift) - Primary feature
- ✅ Settings Interface (F12)
- ✅ Logo Display

**Disabled Features:**
- ❌ Channel Summary (F10)

---

## 📦 Installation

### **Linux (x64)**
```bash
./SlackPolishDeployLinux.sh "Install v1.3.0"
```

Or use the test installer (recommended for now):
```bash
sudo python3 test-with-settings.py
```

### **Requirements**
- Slack Desktop v4.47.69 (or compatible versions)
- Node.js (for asar tool)
- Python 3 (for installer)

---

## 🔄 Upgrade Notes

If you're upgrading from v1.2.x:
1. The installer will automatically backup your current Slack installation
2. All settings and preferences will be preserved
3. The channel summary feature will be disabled until the next release

---

## 🐛 Bug Reports

If you encounter any issues, please check:
1. Slack version compatibility (v4.47.69 tested)
2. Console logs for errors: `slackPolishStatus()` in browser console
3. Hotkey recovery: `slackPolishRecoverHotkey()` if Ctrl+Shift stops working

---

## 🙏 Acknowledgments

Special thanks to the testing and debugging process that helped identify:
- The sourcemap positioning issue
- The fast hotkey press problem
- The file structure corruption bugs

---

## 📅 Next Release (v1.3.1)

Planned features:
- Fix channel summary compatibility
- Optimize logo file size (reduce from 2.1MB)
- Consolidate test installer into main installer
- Comprehensive testing suite

---

**Full Changelog:** See commit history for detailed changes.

