#!/bin/bash

# SlackPolish Deployment Script
# Automates the 4-stage deployment process
# Usage: ./deploy.sh [version] [description]
#   version: Optional version number (e.g., 1.2.0) - if not provided, increments build
#   description: Optional description - if not provided, uses default

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Function to print colored output
print_stage() {
    echo -e "${BLUE}===================================================${NC}"
    echo -e "${BLUE}🚀 STAGE $1: $2${NC}"
    echo -e "${BLUE}===================================================${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${PURPLE}ℹ️ $1${NC}"
}

# Check if we're in the right directory
if [ ! -f "slack-text-improver.js" ] || [ ! -f "version.json" ]; then
    print_error "This script must be run from the SlackPolish root directory"
    exit 1
fi

# Parse arguments
VERSION_ARG=""
DESCRIPTION_ARG=""

if [ $# -eq 1 ]; then
    # Check if argument looks like version (contains dots) or description
    if [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        VERSION_ARG="$1"
    else
        DESCRIPTION_ARG="$1"
    fi
elif [ $# -eq 2 ]; then
    VERSION_ARG="$1"
    DESCRIPTION_ARG="$2"
elif [ $# -gt 2 ]; then
    # Multiple arguments - treat as description
    DESCRIPTION_ARG="$*"
fi

# ===================================================
# STAGE 1: KILL CURRENT SLACK
# ===================================================
print_stage "1" "KILL CURRENT SLACK"

print_info "Terminating existing Slack processes..."
pkill -f slack 2>/dev/null || true

# Wait a moment for processes to fully terminate
sleep 2

# Verify Slack is closed
if pgrep -f slack > /dev/null; then
    print_warning "Some Slack processes still running, forcing termination..."
    pkill -9 -f slack 2>/dev/null || true
    sleep 1
fi

if ! pgrep -f slack > /dev/null; then
    print_success "Slack processes terminated successfully"
else
    print_warning "Some Slack processes may still be running"
fi

# ===================================================
# STAGE 2: INCREMENT VERSION
# ===================================================
print_stage "2" "INCREMENT VERSION"

if [ -n "$VERSION_ARG" ] && [ -n "$DESCRIPTION_ARG" ]; then
    print_info "Setting version to $VERSION_ARG with description: $DESCRIPTION_ARG"
    sudo python3 increment-version.py "$VERSION_ARG" "$DESCRIPTION_ARG"
elif [ -n "$VERSION_ARG" ]; then
    print_info "Setting version to $VERSION_ARG"
    sudo python3 increment-version.py "$VERSION_ARG"
elif [ -n "$DESCRIPTION_ARG" ]; then
    print_info "Incrementing build with description: $DESCRIPTION_ARG"
    sudo python3 increment-version.py "$DESCRIPTION_ARG"
else
    print_info "Incrementing build number"
    sudo python3 increment-version.py
fi

if [ $? -eq 0 ]; then
    print_success "Version updated successfully"
else
    print_error "Failed to update version"
    exit 1
fi

# Get current version for display
CURRENT_VERSION=$(python3 -c "import json; print(json.load(open('version.json'))['version_string'])")
print_info "Current version: $CURRENT_VERSION"

# ===================================================
# STAGE 3: INSTALL WITH SUDO
# ===================================================
print_stage "3" "INSTALL WITH SUDO"

print_info "Installing SlackPolish v$CURRENT_VERSION..."
sudo python3 installers/install-slack-LINUX-X64.py

if [ $? -eq 0 ]; then
    print_success "Installation completed successfully"
else
    print_error "Installation failed"
    exit 1
fi

# ===================================================
# STAGE 4: LAUNCH NEW SLACK
# ===================================================
print_stage "4" "LAUNCH NEW SLACK"

print_info "Starting Slack with SlackPolish v$CURRENT_VERSION..."

# Start Slack in background and detach from terminal
nohup slack > /dev/null 2>&1 &
SLACK_PID=$!

# Wait a moment for Slack to start
sleep 3

# Check if Slack started successfully
if ps -p $SLACK_PID > /dev/null; then
    print_success "Slack started successfully (PID: $SLACK_PID)"
else
    print_warning "Slack process may have exited, but this is normal for some Slack versions"
fi

# ===================================================
# DEPLOYMENT COMPLETE
# ===================================================
echo -e "${GREEN}===================================================${NC}"
echo -e "${GREEN}🎉 DEPLOYMENT COMPLETE!${NC}"
echo -e "${GREEN}===================================================${NC}"

print_success "SlackPolish v$CURRENT_VERSION deployed successfully"
print_info "Next steps:"
echo "  1. Wait for Slack to fully load"
echo "  2. Test hotkey functionality (Ctrl+Shift)"
echo "  3. Access settings with F12 if needed"
echo "  4. Check console for any errors: slackPolishStatus()"

# Show debugging commands
echo ""
print_info "Debugging commands (in browser console):"
echo "  slackPolishStatus()        - Show current status"
echo "  slackPolishRecoverHotkey() - Manually fix hotkey if needed"

echo ""
print_success "Deployment script completed successfully!"
