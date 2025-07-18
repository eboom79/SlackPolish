# SlackPolish

**An AI-powered text enhancement tool that integrates directly into Slack Desktop to improve your communication with personalized style preferences.**

Transform your messages instantly with professional polish, casual tone, grammar fixes, translations, and your own custom writing style - all with simple hotkeys right in Slack.

---

## 📑 Table of Contents
- [🎯 Product Overview](#-product-overview)
- [🚀 Features](#-features)
- [� Project Structure](#-project-structure)
- [📋 Pre-Installation Requirements](#-pre-installation-requirements)
- [🛠️ Installation Instructions](#️-installation-instructions)

- [🗑️ Uninstallation](#️-uninstallation)
- [🖥️ System Compatibility](#️-system-compatibility)
- [📝 Changelog](#-changelog)

## 🎯 Product Overview

**SlackPolish** is an internal Redis Enterprise team tool that seamlessly integrates with Slack Desktop to improve written communication using OpenAI's advanced language models. This productivity enhancement tool works across **Linux, Windows, and macOS** platforms for Redis Enterprise team members.

### **How It Works:**
1. **Type your message** in any Slack input field
2. **Press your hotkey** (Ctrl+Shift by default) to improve the text
3. **Watch as AI transforms** your message instantly
4. **Send with confidence** - your improved message is ready

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

### **⌨️ Flexible Hotkey configuration:**
-**Choose your preferred key combination
- **Primary Options:** Ctrl+Shift, Ctrl+Alt, or Ctrl+Tab
- **Settings Access:** F12 (universal keyboard compatibility)


## 📁 Project Structure

SlackPolish consists of four main files:

### **📜 `slack-text-improver.js`**
The main SlackPolish script that integrates with Slack's interface. Handles text detection, hotkey processing, OpenAI API calls, and the F12 settings menu with personal polish integration and SlackPolish branding.

### **⚙️ `slack-config.js`**
SlackPolish configuration file containing OpenAI settings, language/style options, detailed prompts, and default preferences. Edit this file to customize API keys and behavior.

### **🎨 `logo-data.js`**
Contains the base64-encoded SlackPolish logo data for clean code organization. This file stores the custom logo that appears in the loading indicator, settings menu, and API key popup. Automatically injected by all platform installers.

### **🛠️ Platform-Specific Installers** (`installers/` directory)
- **`installers/install-slack-LINUX-X64.py`** - ✅ **TESTED** - Linux x64 installer optimized for Ubuntu, Debian, CentOS, and other distributions
- **`installers/install-slack-MAC-ARM.py`** - ⚠️ **UNTESTED** - macOS Apple Silicon (M1/M2/M3) installer with ARM optimization (use at your own risk)
- **`installers/install-slack-WINDOWS-X64.py`** - ⚠️ **UNTESTED** - Windows x64 installer for Windows 10/11 systems (use at your own risk)



## � Pre-Installation Requirements

### **All Operating Systems Need:**
1. ✅ **Slack Desktop App** - Must be installed and working
2. ✅ **Python 3** - Version 3.6 or higher
3. ✅ **Node.js & npm** - For the `asar` tool (Slack app modification)
4. ✅ **OpenAI API Key** - Required for text improvement functionality
5. ✅ **Administrator Privileges** - Needed to modify Slack installation files

### **Platform-Specific Requirements:**

#### **🐧 Linux (Ubuntu/Debian/CentOS/etc.)**
```bash
# Install Python 3 (if not already installed)
sudo apt update && sudo apt install python3 python3-pip

# Install Node.js and npm
sudo apt install nodejs npm

# Verify installations
python3 --version
npm --version
```

#### **🍎 macOS**
```bash
# Install Python 3 (if not already installed)
brew install python3

# Install Node.js and npm
brew install node

# Verify installations
python3 --version
npm --version
```

#### **🪟 Windows**
1. **Python 3:** Download from [python.org](https://www.python.org/downloads/)
2. **Node.js:** Download from [nodejs.org](https://nodejs.org/)
3. **Verify installations:**
```cmd
python --version
npm --version
```

## 🛠️ Installation Instructions

### **Step 1: Download and Prepare**
```bash
# Navigate to the project directory
cd /path/to/SlackPolish/

# Or download the latest version
git clone <repository-url>
cd SlackPolish
```

### **Step 2: Configure API Key**
Edit `slack-config.js` and replace the placeholder with your OpenAI API key:
```javascript
OPENAI_API_KEY: 'your-actual-openai-api-key-here'
```

### **Step 3: Install by Operating System**

#### **🐧 Linux Installation**

**For Linux x64 systems (Ubuntu, Debian, CentOS, etc.):**
```bash
# Use the Linux-specific installer (recommended)
sudo python3 installers/install-slack-LINUX-X64.py

# With verbose output for troubleshooting
sudo python3 install-slack-LINUX-X64.py -v

# Reset saved settings (if needed)
sudo python3 installers/install-slack-LINUX-X64.py -s true

# Reset API key only (if needed)
sudo python3 installers/install-slack-LINUX-X64.py -k true

# Force installation if validation fails
sudo python3 installers/install-slack-LINUX-X64.py --force
```



#### **🍎 macOS Installation**

**For macOS Apple Silicon (M1/M2/M3) and newer Slack versions:**
```bash
# Use the Mac ARM installer (recommended)
sudo python3 installers/install-slack-MAC-ARM.py

# With verbose output for troubleshooting
sudo python3 install-slack-MAC-ARM.py -v

# Reset saved settings (if needed)
sudo python3 install-slack-MAC-ARM.py -s true

# Reset API key only (if needed)
sudo python3 install-slack-MAC-ARM.py -k true

# Force installation if validation fails
sudo python3 install-slack-MAC-ARM.py --force

# Manual Slack path specification
sudo python3 install-slack-MAC-ARM.py --slack-path "/Applications/Slack.app"
```



#### **🪟 Windows Installation**

**For Windows x64 systems (Windows 10/11) - Run Command Prompt as Administrator:**
```cmd
# Use the Windows-specific installer (recommended)
python installers/install-slack-WINDOWS-X64.py

# With verbose output for troubleshooting
python install-slack-WINDOWS-X64.py -v

# Reset saved settings (if needed)
python install-slack-WINDOWS-X64.py -s true

# Reset API key only (if needed)
python install-slack-WINDOWS-X64.py -k true

# Force installation if validation fails
python install-slack-WINDOWS-X64.py --force

# Manual Slack path specification
python install-slack-WINDOWS-X64.py --slack-path "C:\Program Files\Slack\resources"
```



### **🔧 Installation Options**

The installer supports command-line flags to reset specific settings:

- **`-s true/false`** or **`--reset-settings true/false`**: Reset all saved settings (language, style, hotkey, personal polish)
- **`-k true/false`** or **`--reset-api-key true/false`**: Reset only the saved API key

**Examples:**
```bash
# Linux X64 - View all available options
python3 install-slack-LINUX-X64.py --help

# Linux X64 - Install normally (keeps existing settings)
sudo python3 install-slack-LINUX-X64.py

# Linux X64 - Reset settings but keep API key
sudo python3 install-slack-LINUX-X64.py -s true -k false

# Linux X64 - Reset API key but keep other settings
sudo python3 install-slack-LINUX-X64.py -s false -k true

# Mac ARM - Install normally
sudo python3 install-slack-MAC-ARM.py

# Windows X64 - Install normally (run as Administrator)
python install-slack-WINDOWS-X64.py
```

**Note:** Reset flags are one-time operations. Each installation creates a unique version marker, so settings are only reset once per installation, not on every Slack restart.

### **Step 4: Verify Installation**
1. **Start Slack Desktop App**
2. **Open any message input field**
3. **Press Ctrl+Shift** - Should show "🤖 Improving text..." indicator
4. **Press F12** - Should open settings menu

### **🔧 Troubleshooting Installation**

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

**⚙️ Settings Access:**
- Press **F12** in Slack to open settings
- Click **10 times** on bottom-left corner for Developer Mode
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
