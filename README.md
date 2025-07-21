# SlackPolish

**An AI-powered text enhancement tool that integrates directly into Slack Desktop to improve your communication with personalized style preferences.**

Transform your messages instantly with professional polish, casual tone, grammar fixes, translations, and your own custom writing style - all with simple hotkeys right in Slack.

**🆕 NEW: Want a summary of a Slack channel?** Press **F10** to get AI-powered channel summaries with flexible time ranges (24h, 7d, 30d, or entire channel) and customizable detail levels!

---

## 📑 Table of Contents
- [🎯 Product Overview](#-product-overview)
- [🚀 Features](#-features)
- [� Project Structure](#-project-structure)
- [📋 Pre-Installation Requirements](#-pre-installation-requirements)
- [🛠️ Installation Instructions (Linux Only)](#️-installation-instructions-linux-only)
- [🚫 Platform Support Status](#-platform-support-status)
- [🗑️ Uninstallation](#️-uninstallation)
- [🖥️ System Compatibility](#️-system-compatibility)
- [📝 Changelog](#-changelog)

## 🎯 Product Overview

**SlackPolish** is an internal Redis Enterprise team tool that seamlessly integrates with Slack Desktop to improve written communication using OpenAI's advanced language models. This productivity enhancement tool is currently **Linux-focused** and optimized for Redis Enterprise team members using Linux environments.

### **How It Works:**

**📝 For Text Improvement:**
1. **Type your message** in any Slack input field
2. **Press your hotkey** (Ctrl+Shift by default) to improve the text
3. **Watch as AI transforms** your message instantly
4. **Send with confidence** - your improved message is ready

**📊 For Channel Summary:**
1. **Navigate to any channel** you want to summarize
2. **Press F10** to open the Channel Summary window
3. **Select time range** (24h, 7d, 30d, or entire channel) and summary level
4. **Click Generate** - get AI-powered insights of channel conversations

## 🚀 Features

### **🌍 Multilingual Support (8 Languages):**
- 🇺🇸 **English** - Native language support
- 🇪🇸 **Spanish** - Full translation and improvement
- 🇫🇷 **French** - Professional and casual styles
- 🇩🇪 **German** - Business and informal communication
- 🇮🇱 **Hebrew** - Right-to-left language support
- 🇨🇳 **Chinese (Simplified)** - Asian language support
- 🇮🇳 **Hindi** - Indian subcontinent support
- 🇧🇬 **Bulgarian** - Eastern European support

### **🎨 Text Improvement Styles (5 Options):**
- 💼 **Professional** - Business-appropriate tone and formal language
- 😊 **Casual** - Friendly, relaxed, and conversational style
- ⚡ **Concise** - Brief, direct, and to-the-point communication
- ✏️ **Grammar Fix** - Correct errors while maintaining original tone
- 🌍 **Translate Only** - Pure translation between any supported languages

### **✨ Personal Polish:**
- **Custom Style Preferences** - Add your own writing guidelines
- **Examples:** "I prefer 'Hi' instead of 'Hey'", "Don't use dashes (-)"

### **📊 Channel Summary (NEW):**
- **AI-Powered Summarization** - Press F10 to summarize channel conversations
- **Flexible Time Ranges** - 24 hours, 7 days, 30 days, or entire channel
- **Summary Levels** - Executive Summary (concise) or Comprehensive (detailed)
- **Professional Interface** - Clean, compact design with side-by-side controls

### **⌨️ Flexible Hotkey Configuration:**
- **Choose your preferred key combination**
- **Primary Options:** Ctrl+Shift, Ctrl+Alt, or Ctrl+Tab
- **Settings Access:** F12 (universal keyboard compatibility)
- **Channel Summary:** F10 (AI-powered channel summarization)


## 📁 Project Structure

SlackPolish uses a **modular architecture** with functionality divided into independent scripts for better maintainability:

### **📜 `slack-text-improver.js`**
Core text improvement functionality. Handles text detection, hotkey processing (Ctrl+Shift), OpenAI API calls, and smart context integration. The main entry point that coordinates with other modules.

### **⚙️ `slack-settings.js`**
Independent settings management module. Handles F12 settings menu, user preferences, API key management, developer mode, and version display. Maintains separation of concerns from text improvement.

### **📊 `slack-channel-summary.js`**
Channel summarization module. Handles F10 hotkey, AI-powered channel analysis, time range selection (24h/7d/30d/entire), summary levels (Executive/Comprehensive), and professional UI interface.


### **⚙️ `slack-config.js`**
Configuration file containing OpenAI settings, language/style options, detailed prompts, version information, and default preferences. Central configuration for all modules.

### **🎨 `logo-data.js`**
Base64-encoded SlackPolish logo data for clean code organization. Custom logo appears in loading indicators, settings menu, channel summary, and API key popups.


## � Pre-Installation Requirements

### **All Operating Systems Need:**
1. ✅ **Slack Desktop App** - Must be installed and working
2. ✅ **Python 3** - Version 3.6 or higher
3. ✅ **Node.js & npm** - For the `asar` tool (Slack app modification)
4. ✅ **OpenAI API Key** - Required for AI text improvement and channel summary features
   - Get your API key from: [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
   - **Note**: You'll be prompted to enter this on first use - no need to configure it during installation
5. ✅ **Administrator Privileges** - Needed to modify Slack installation files




## 🛠️ Installation Instructions (Linux Only)





### **🐧 Linux Requirements**

**For Linux x64 systems (Ubuntu, Debian, CentOS, etc.):**

```bash
# Install Python 3 (if not already installed)
sudo apt update && sudo apt install python3 python3-pip

# Install Node.js and npm
sudo apt install nodejs npm

# Verify installations
python3 --version
npm --version
```

### **Step 1: Download SlackPolish**
```bash
# Navigate to your desired directory
cd /path/to/your/projects/

# Clone the repository
git clone https://github.com/eboom79/SlackPolish.git
cd SlackPolish
```

### **Step 2: Install SlackPolish**
```bash
sudo python3 installers/install-slack-LINUX-X64.py
```


### **Step 3: Verify Installation**
1. **Start Slack Desktop App**
2. **Open any message input field**
3. **Press Ctrl+Shift** - Should show "🤖 Improving text..." indicator
4. **Press F12** - Should open settings menu with version information
5. **Press F10** - Should open Channel Summary window with time range options

### **� First Use - API Key Setup**

**On your first use of SlackPolish**, you'll be prompted to enter your OpenAI API key:

1. **Press Ctrl+Shift** in any message field (or F10 for channel summary)
2. **API Key Popup** will appear automatically if no key is configured
3. **Enter your OpenAI API key** (starts with `sk-...`)
4. **Click "Save & Retry"** - Your key is securely stored locally
5. **Start using SlackPolish** - No further configuration needed!

**💡 Tip**: You can always update your API key later by pressing **F12** → Settings Menu

## 🚫 Platform Support Status

### **✅ Supported Platforms**
- **🐧 Linux x64** - Fully tested and supported (Ubuntu, Debian, CentOS, etc.)

### **❌ Currently Unsupported Platforms**
- **🍎 macOS** - Not supported at this time
- **🪟 Windows** - Not supported at this time

**Note**: SlackPolish is currently focused on Linux environments. macOS and Windows support may be added in future releases based on user demand.

### **�🔧 Troubleshooting Installation**

#### **If `asar` tool is missing:**
```bash
# Install globally
npm install -g asar

# Or let the installer handle it automatically
# (it will install locally if global installation fails)
```

#### **If Slack path is not found:**
The installer automatically detects Slack in these locations:
- **Linux:** `/usr/lib/slack/resources`
- **macOS:** `/Applications/Slack.app/Contents/Resources`
- **Windows:** `C:\Program Files\Slack\resources` or `C:\Program Files (x86)\Slack\resources`

#### **macOS-Specific Troubleshooting:**

**For Apple Silicon Macs (M1/M2/M3) or Slack 4.44.65+:**
```bash
# Use the Mac-specific installer with verbose output
sudo python3 install-slack-MAC-index-js -v

# If Slack path detection fails, specify manually
sudo python3 install-slack-MAC-index-js --slack-path "/Applications/Slack.app"

# If file validation fails, force installation
sudo python3 install-slack-MAC-index-js --force
```

**Common macOS Issues:**
- **"No preload files found"** → Use `install-slack-MAC-index-js` (handles newer Slack versions with index.js)
- **"Permission denied"** → Make sure to use `sudo`
- **"asar tool not found"** → Install with `brew install node` then `npm install -g asar`
- **Apple Silicon issues** → The Mac installer has ARM-specific detection and paths

#### **If Slack installation is not found (Windows):**
The installer checks these locations automatically:
- `%USERPROFILE%\AppData\Local\slack\resources` (most common)
- `C:\Program Files\Slack\resources`
- `C:\Program Files (x86)\Slack\resources`
- `%USERPROFILE%\AppData\Local\Programs\slack\resources`
- And 7 other common locations

**If automatic detection fails:**
1. **Find your Slack installation:**
   - Open File Explorer
   - Navigate to where Slack is installed
   - Look for a `resources` folder containing `app.asar` file
2. **The installer will prompt you to enter the path manually**
3. **Common locations to check:**
   ```
   %USERPROFILE%\AppData\Local\slack\resources
   %USERPROFILE%\AppData\Local\Programs\slack\resources
   C:\Program Files\Slack\resources
   ```

#### **If permission errors occur:**
- **Linux/macOS:** Ensure you're using `sudo`
- **Windows:** Run Command Prompt as Administrator

## 🗑️ Uninstallation

### **Complete Removal (All Platforms)**

The installer automatically creates a backup of the original Slack files. To uninstall:

#### **🐧 Linux Uninstallation**
```bash
# Navigate to Slack resources directory
cd /usr/lib/slack/resources

# Restore original file (requires sudo)
sudo cp app.asar.backup app.asar

# Verify restoration
ls -la app.asar*
```

#### **🍎 macOS Uninstallation**
```bash
# Navigate to Slack resources directory
cd "/Applications/Slack.app/Contents/Resources"

# Restore original file (requires sudo)
sudo cp app.asar.backup app.asar

# Verify restoration
ls -la app.asar*
```

#### **🪟 Windows Uninstallation**
**Run Command Prompt as Administrator**, then:
```cmd
# Navigate to Slack resources directory (adjust path if needed)
cd "C:\Program Files\Slack\resources"

# Restore original file
copy app.asar.backup app.asar

# Verify restoration
dir app.asar*
```

## 🖥️ System Compatibility

### **Supported Operating Systems**
- ✅ **Linux** - Ubuntu, Debian, CentOS, Fedora, and other distributions
- ✅ **macOS** - macOS 10.13 (2017) or newer
- ✅ **Windows** - Windows 10/11 (both 32-bit and 64-bit)

### **Supported Slack Versions**
- ✅ **Slack Desktop App** - All recent versions using Electron framework
- ❌ **Slack Web Browser** - Not supported (requires desktop app)
- ❌ **Slack Mobile** - Not supported (desktop only)

### **International Keyboard Support**
- ✅ **Universal F12 Settings** - Works on all keyboard layouts
- ✅ **Multi-language Keyboards** - Hebrew, Arabic, Chinese, Cyrillic, etc.
- ✅ **Regional Variants** - QWERTY, AZERTY, QWERTZ, and others

---

## 📝 Changelog

### **🚀 v1.0.52 - Major Feature Update: Channel Summary + Modular Architecture**
**Date:** July 19, 2025 - 15:30:00
**Status:** ✅ **PRODUCTION READY - MAJOR FEATURE RELEASE WITH MODULAR ARCHITECTURE**

**🎉 NEW MAJOR FEATURES:**
- **📊 Channel Summary** - Complete F10 hotkey-triggered AI-powered channel summarization
- **⚙️ Version Display** - Settings menu now shows version and build number in header
- **🏗️ Modular Architecture** - Separated functionality into independent, maintainable scripts
- **🎨 Improved UI Layout** - Side-by-side dropdowns in Channel Summary for better UX

**📊 Channel Summary Features:**
- **F10 Hotkey** - Quick access to channel summarization from anywhere in Slack
- **Flexible Time Ranges** - 24 hours, 7 days, 30 days, or entire channel
- **Two Summary Levels** - Executive Summary (concise) or Comprehensive (detailed)
- **Professional Interface** - Compact design that fits without scrolling
- **Smart Context** - Includes entire threads when main message falls within time range

**🏗️ Modular Architecture:**
- **`slack-channel-summary.js`** - Independent channel summarization module
- **`slack-settings.js`** - Separate settings management with version display
- **`slack-core.js`** - Shared utilities and debug system integration
- **Clean Separation** - Each module handles specific functionality independently

**🎨 User Experience Improvements:**
- **Version Information** - Settings header displays v1.0.52 (Build 52) - 2025-07-19
- **Side-by-Side Controls** - Time range and summary level dropdowns positioned horizontally
- **Compact Design** - All elements visible without scrolling for better usability
- **Professional Branding** - Consistent logo usage across all modules

**🔧 Technical Enhancements:**
- **Enhanced Installer** - Updated Linux installer with comprehensive cleanup
- **Debug Integration** - Unified debug system across all modules
- **Version Management** - Automated version increment system
- **Test Updates** - Updated test architecture for new modular design

### **🆕 v8.9.8 - External Logo System & Complete Test Coverage**
**Date:** July 17, 2025 - 19:05:00
**Status:** ✅ **PRODUCTION READY - EXTERNAL LOGO SYSTEM WITH 100% TEST COVERAGE**

**🎨 External Logo Integration:**
- Moved logo data to separate `logo-data.js` file for clean code organization
- All platform installers (Linux, macOS, Windows) now inject logo file automatically
- External logo reference with fallback system for maximum reliability
- Custom logo appears in loading indicator, settings menu, and API key popup

**✅ Complete Test Coverage:**
- 100% test suite pass rate with 11 comprehensive test categories
- Updated tests for new external logo system
- Branding integration, UI elements, and file structure validation
- All core functionality thoroughly verified and stable

**📚 Documentation Updates:**
- README reflects new 4-file project structure including logo file
- Clear documentation of logo system and file organization
- Updated project structure section with logo file description

### **v8.9.7 - Complete Professional Solution with Safety Disclaimers**
**Date:** July 17, 2025 - 16:17:55
**Status:** ✅ **PRODUCTION READY - COMPLETE PROFESSIONAL SOLUTION WITH SAFETY PROTECTION**

**🎉 Complete Feature Set:**

**Core Text Improvement:**
- � **AI-Powered Enhancement** - Uses OpenAI GPT models for intelligent text improvement
- 🌍 **8 Languages** - English, Spanish, French, German, Italian, Portuguese, Dutch, Japanese
- ✨ **5 Writing Styles** - Professional, Casual, Formal, Creative, Technical
- 🎨 **Personal Polish** - Custom style preferences (e.g., "Use 'Hi' not 'Hey'", "Avoid dashes")
- ⌨️ **Flexible Hotkeys** - Ctrl+Shift (default), Ctrl+Alt, Ctrl+Tab, or F12 for settings

**Smart Context System:**
- 🧠 **Intelligent Context** - Automatically includes recent conversation context when helpful
- 🎯 **Smart Detection** - Activates for short messages, ambiguous responses, and pronoun references
- 🧵 **Thread Support** - Works seamlessly in both main channels and thread discussions
- 🔒 **Privacy Protection** - Sanitizes emails, URLs, phone numbers; optional name anonymization
- ⚡ **Performance Optimized** - Caches messages, processes only today's content

**Developer Mode & Settings:**
- 🔧 **Hidden Developer Mode** - Click 10x on bottom-left corner of settings for advanced options
- 🔑 **API Key Management** - View, edit, test, and validate OpenAI API keys in real-time
- 🔍 **Debug Mode** - Visual debug boxes for troubleshooting text input and context detection
- 📱 **Compact UI** - Responsive settings menu that fits on laptop screens
- 💾 **Persistent Settings** - Auto-save with corruption recovery and emergency reset (Ctrl+Shift+Alt+R)

**Platform-Specific Installers with Safety Protection:**
- 🐧 **Linux x64** - ✅ Fully tested - Ubuntu, Debian, CentOS support with snap package detection
- 🍎 **macOS ARM** - ⚠️ Untested with safety warnings - Apple Silicon (M1/M2/M3) with Homebrew integration
- 🪟 **Windows x64** - ⚠️ Untested with safety warnings - Windows 10/11 with Administrator guidance

**Safety Features:**
- 🛡️ **Interactive Warnings** - Untested installers require explicit user confirmation (y/N)
- 📋 **Clear Risk Communication** - Users understand potential consequences before proceeding
- 🔒 **Default to Safety** - All prompts default to cancellation unless user explicitly agrees
- 💡 **Helpful Guidance** - Points users to tested alternatives and safety recommendations

**🚀 Usage Examples:**

**Basic Text Improvement:**
```
Input: "let me know"
Output: "Please let me know when you have a chance."
```

**Smart Context in Action:**
```
Context: [2:30 PM] Sarah: "Should we move the meeting to 3 PM?"
Input: "sounds good"
Output: "That sounds perfect. I'll adjust my calendar for the 3 PM meeting."
```

**Developer Mode Features:**
- **API Key Testing**: Real-time validation and testing of OpenAI API keys
- **Debug Visualization**: Green overlay boxes showing text input detection and context extraction
- **Advanced Settings**: Smart Context privacy controls and debug logging options

### **v8.9.5 - Platform-Specific Installers**
**Date:** July 17, 2025 - 14:00:00
**Status:** ✅ **PRODUCTION READY WITH PLATFORM-OPTIMIZED INSTALLERS**

**Major Features Added:**
- 🎯 **Platform-Specific Installers** - Dedicated installers for each platform and architecture
- 🍎 **macOS ARM Installer** - `install-slack-MAC-ARM.py` optimized for Apple Silicon (M1/M2/M3)
- 🐧 **Linux x64 Installer** - `install-slack-LINUX-X64.py` optimized for Linux distributions
- 🪟 **Windows x64 Installer** - `install-slack-WINDOWS-X64.py` optimized for Windows 10/11

**Platform Optimizations:**
- **macOS ARM**: Homebrew paths, ARM-specific Node.js detection, index.js support for newer Slack versions
- **Linux x64**: Distribution detection, snap package support, comprehensive path searching
- **Windows x64**: Windows-specific paths, .cmd file handling, Administrator privilege guidance

**Enhanced Features (All Platforms):**
- **Verbose mode** (`-v`) for detailed troubleshooting output
- **Force mode** (`--force`) to bypass validation issues
- **Manual path specification** (`--slack-path`) for custom installations
- **Better error messages** with platform-specific troubleshooting guidance
- **Flexible file detection** supporting both traditional preload files and newer index.js architecture

**🛠️ Quick Installation:**

⚠️ **IMPORTANT TESTING STATUS:**
- ✅ **Linux x64**: Fully tested and verified on Ubuntu/Debian systems
- ⚠️ **macOS ARM**: Not tested - may break your Slack installation
- ⚠️ **Windows x64**: Not tested - may break your Slack installation

```bash
# Linux x64 (Ubuntu/Debian/CentOS) - TESTED ✅
sudo python3 install-slack-LINUX-X64.py

# macOS Apple Silicon (M1/M2/M3) - UNTESTED ⚠️
sudo python3 install-slack-MAC-ARM.py

# Windows x64 (Run as Administrator) - UNTESTED ⚠️
python install-slack-WINDOWS-X64.py
```

**⚠️ Risk Warning for macOS and Windows:**
The macOS and Windows installers have not been tested and may damage your Slack installation. Only the Linux installer has been verified to work safely. Use macOS/Windows installers at your own risk and ensure you have backups.

**⚙️ Settings & Features Access:**
- Press **F12** in Slack to open settings menu (with version display)
- Press **F10** in Slack to open Channel Summary window
- Click **10 times** on bottom-left corner of settings for Developer Mode
- **Ctrl+Shift+Alt+R** for emergency reset

---

## 📋 **Version History**

### **Previous Versions**

**v8.9.6 - Smart Context System** (July 17, 2025)
- Added intelligent conversation context detection and thread support
- Privacy protection with data sanitization and name anonymization
- Performance optimization with message caching and smart activation

**v8.9.5 - Platform-Specific Installers** (July 17, 2025)
- Dedicated installers for macOS ARM, Linux x64, and Windows x64
- Platform-optimized detection, error handling, and troubleshooting
- Enhanced verbose mode and manual path specification

- Apple Silicon (M1/M2/M3) compatibility and Homebrew integration
- Support for newer Slack versions (4.44.65+) with index.js architecture

---

## 🤝 **Contributing**

SlackPolish is a complete, production-ready solution. For issues or feature requests, please ensure you're using the correct platform-specific installer and have followed the installation instructions.

## � **License**

This project is provided as-is for educational and productivity purposes. Please respect OpenAI's API usage policies and Slack's terms of service.

---

**🎉 Enjoy your enhanced Slack experience with SlackPolish!** 🚀
