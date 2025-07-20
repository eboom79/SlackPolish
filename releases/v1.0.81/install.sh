#!/bin/bash

# SlackPolish v1.0.81 Installation Script
# This script provides an easy way to install SlackPolish on Linux x64 systems

echo "🎉 SlackPolish v1.0.81 Installer"
echo "=================================="
echo ""

# Check if running as root
if [ "$EUID" -eq 0 ]; then
    echo "❌ Please do not run this script as root directly."
    echo "   The script will ask for sudo permissions when needed."
    echo ""
    echo "Usage: ./install.sh"
    exit 1
fi

# Check if Python 3 is available
if ! command -v python3 &> /dev/null; then
    echo "❌ Python 3 is required but not installed."
    echo "   Please install Python 3.6 or higher and try again."
    exit 1
fi

# Check Python version
PYTHON_VERSION=$(python3 -c 'import sys; print(".".join(map(str, sys.version_info[:2])))')
REQUIRED_VERSION="3.6"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$PYTHON_VERSION" | sort -V | head -n1)" != "$REQUIRED_VERSION" ]; then
    echo "❌ Python $PYTHON_VERSION found, but Python $REQUIRED_VERSION or higher is required."
    exit 1
fi

echo "✅ Python $PYTHON_VERSION found"

# Check if Slack is installed
if [ ! -d "/usr/lib/slack" ]; then
    echo "❌ Slack desktop application not found at /usr/lib/slack"
    echo "   Please install Slack desktop application first."
    echo "   Download from: https://slack.com/downloads/linux"
    exit 1
fi

echo "✅ Slack installation found"

# Check system architecture
ARCH=$(uname -m)
if [ "$ARCH" != "x86_64" ]; then
    echo "❌ This installer is for x64 systems only."
    echo "   Your system architecture: $ARCH"
    exit 1
fi

echo "✅ System architecture: $ARCH"
echo ""

# Show what will be installed
echo "📦 Installation Summary:"
echo "   • SlackPolish Text Improver (Ctrl+Shift)"
echo "   • Channel Summary Feature (F10)"
echo "   • Settings Management (F12)"
echo "   • Enhanced debugging and error handling"
echo ""

# Confirm installation
read -p "🤔 Do you want to proceed with installation? (y/N): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Installation cancelled."
    exit 0
fi

echo ""
echo "🚀 Starting installation..."
echo ""

# Run the installer
if sudo python3 installers/install-slack-LINUX-X64.py; then
    echo ""
    echo "🎉 Installation completed successfully!"
    echo ""
    echo "📋 Next Steps:"
    echo "   1. Restart Slack desktop application"
    echo "   2. Get your OpenAI API key from: https://platform.openai.com/api-keys"
    echo "   3. In Slack, press F12 to open SlackPolish settings"
    echo "   4. Enter your API key and save"
    echo ""
    echo "🎯 How to Use:"
    echo "   • Text Improvement: Select text and press Ctrl+Shift"
    echo "   • Channel Summary: Press F10 in any channel"
    echo "   • Settings: Press F12 to configure"
    echo ""
    echo "🆘 Need Help?"
    echo "   • Read RELEASE_NOTES.md for detailed instructions"
    echo "   • Check README.md for full documentation"
    echo "   • Report issues: https://github.com/eboom79/SlackPolish/issues"
    echo ""
    echo "✨ Enjoy SlackPolish v1.0.81!"
else
    echo ""
    echo "❌ Installation failed!"
    echo "   Please check the error messages above and try again."
    echo "   Make sure you have the required permissions and dependencies."
    exit 1
fi
