# SlackPolish v1.4.0 Release Notes

**Release Date:** April 8, 2026  
**Build:** 0

## 🎉 Major Milestone: New macOS ARM Support

This release introduces macOS Apple Silicon support for SlackPolish.

It closes the long-standing macOS support request and replaces the previous
experimental ASAR-mutation path with a runtime launcher architecture that keeps
`Slack.app` untouched.

**Related issue:** Closes #1 - `SlackPolish MAC OS - ARM support`

---

## ✨ What's New

### **New macOS Apple Silicon Support**
- ✅ Added working macOS ARM support for SlackPolish
- ✅ SlackPolish now runs on Apple Silicon Macs without modifying `Slack.app`
- ✅ Runtime launcher injects SlackPolish into the live Slack workspace
- ✅ Daily use now works through a dedicated Desktop app entry point

### **New macOS Runtime Architecture**
- ✅ Added `installers/launch-slackpolish-MAC-ARM.py`
- ✅ SlackPolish now uses a DevTools-based runtime injection flow on macOS
- ✅ Injection targets the real Slack workspace page instead of patching Slack’s packaged files
- ✅ No `app-arm64.asar` repack is required
- ✅ No `Info.plist` mutation is required

### **New macOS Install and Uninstall Flow**
- ✅ Replaced the old macOS installer with a runtime installer
- ✅ Added a runtime uninstaller that removes only SlackPolish files
- ✅ Installer creates a smart `SlackPolish.app` Desktop entry point
- ✅ `SlackPolish.app` now:
  - attaches if Slack is already running
  - launches Slack with SlackPolish if Slack is not running

### **macOS App Icon and Packaging**
- ✅ Added a dedicated SlackPolish macOS app icon asset
- ✅ Added a new GitHub Actions macOS package builder
- ✅ Releases can now attach a macOS ARM zip package alongside the Linux package

---

## 🔧 Technical Summary

### **Why the macOS approach changed**
The older macOS direction relied on rewriting Slack’s packaged ASAR payload.
That approach turned out not to be behaviorally safe on current Slack for macOS,
even when Electron ASAR integrity was updated correctly.

The new design avoids that entire class of failure by treating Slack as a
runtime host instead of rewriting the signed app bundle.

### **What the new launcher does**
1. Starts or attaches to Slack with a DevTools debugging port
2. Polls Slack page targets over the DevTools protocol
3. Finds real workspace targets under `https://app.slack.com/client/...`
4. Injects SlackPolish directly into the workspace page at runtime

---

## 📦 Installation

### **macOS Apple Silicon**
```bash
python3 installers/install-slack-MAC-ARM.py
```

After installation, use:

- `~/Desktop/SlackPolish.app`

### **Linux**
```bash
sudo python3 installers/install-slack-LINUX-X64.py
```

---

## 🚀 User-Facing Impact

### **macOS users now get**
- ✅ working SlackPolish support on Apple Silicon
- ✅ no Slack bundle mutation
- ✅ a simple Desktop app launcher
- ✅ safer install and uninstall behavior

### **Existing Linux users keep**
- ✅ the current Linux installation flow
- ✅ no regression to shared SlackPolish runtime behavior

---

## 🗑️ Uninstallation

### **macOS**
```bash
python3 installers/uninstall-slack-MAC-ARM.py
```

This removes the SlackPolish runtime installation and Desktop launchers. It does
not modify `Slack.app`.

---

## 📚 Documentation Updates

- ✅ README now presents macOS ARM as supported
- ✅ Added dedicated macOS runtime launcher documentation
- ✅ Updated macOS install and uninstall instructions

---

## 🙏 Notes

This release is a major platform milestone for the project: macOS support is no
longer just a request or experimental path. It is now a supported installation
flow built around a safer architecture.

---

**Full Changelog:** See commit history for detailed changes.
