#!/usr/bin/env python3
"""
SlackPolish Installer for Linux x64
Optimized for Linux distributions (Ubuntu, Debian, CentOS, etc.)
"""

import os
import sys
import subprocess
import shutil
import re
import argparse
import json
from datetime import datetime
from pathlib import Path
import time

# ANSI colors (Windows may not support these, but we'll include them)
GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
BLUE = "\033[94m"
RESET = "\033[0m"

# Global verbose flag
VERBOSE = False

def print_header(text):
    print(f"\n{BLUE}==================================================")
    print(f"{text}")
    print(f"=================================================={RESET}\n")

def print_success(text):
    print(f"{GREEN}✅ {text}{RESET}")

def print_warning(text):
    print(f"{YELLOW}⚠️ {text}{RESET}")

def print_error(text):
    print(f"{RED}❌ {text}{RESET}")

def print_info(text):
    print(f"{BLUE}🔍 {text}{RESET}")

def print_verbose(text):
    if VERBOSE:
        print(f"{BLUE}🔍 [VERBOSE] {text}{RESET}")

def detect_linux_system():
    """Detect Linux system and validate platform."""
    import platform
    
    system = platform.system()
    machine = platform.machine().lower()
    
    if system != "Linux":
        print_error("This installer is specifically for Linux. Detected: " + system)
        print_info("Use install-slack-MAC-ARM.py for macOS or install-slack-WINDOWS-X64.py for Windows")
        return False
    
    print_success(f"✅ Linux system detected ({machine})")
    
    # Detect distribution
    try:
        with open('/etc/os-release', 'r') as f:
            os_info = f.read()
        if 'ubuntu' in os_info.lower():
            print_verbose("Ubuntu detected")
        elif 'debian' in os_info.lower():
            print_verbose("Debian detected")
        elif 'centos' in os_info.lower():
            print_verbose("CentOS detected")
        elif 'fedora' in os_info.lower():
            print_verbose("Fedora detected")
    except:
        print_verbose("Could not detect specific Linux distribution")
    
    return True

def find_slack_installation_linux():
    """Find Slack installation on Linux."""
    print_info("Searching for Slack installation on Linux...")
    
    # Linux-specific paths (prioritized by commonality)
    possible_paths = [
        "/usr/lib/slack/resources",                                    # Most common
        "/opt/slack/resources",                                        # Alternative
        "/snap/slack/current/usr/lib/slack/resources",                # Snap package
        str(Path.home() / ".local" / "share" / "slack" / "resources"), # User install
        "/usr/local/lib/slack/resources",                             # Local install
        "/var/lib/snapd/snap/slack/current/usr/lib/slack/resources",  # Snap alternative
    ]
    
    for path in possible_paths:
        print_verbose(f"Checking: {path}")
        if os.path.exists(path) and os.path.isfile(os.path.join(path, "app.asar")):
            print_success(f"Found Slack at: {path}")
            return path
        else:
            print_verbose(f"   ❌ Not found")
    
    # Deep search in common directories
    print_verbose("Performing deep search...")
    search_dirs = [
        "/usr/lib",
        "/opt",
        "/usr/local/lib",
        str(Path.home() / ".local" / "share"),
    ]
    
    for search_dir in search_dirs:
        if os.path.exists(search_dir):
            for root, dirs, files in os.walk(search_dir):
                if "slack" in root.lower() and "app.asar" in files:
                    slack_path = root
                    print_success(f"Found Slack at: {slack_path}")
                    return slack_path
    
    return None

def check_asar_tool_linux():
    """Check for asar tool on Linux."""
    print_verbose("Checking for asar tool on Linux...")
    
    # Check local installation first
    local_paths = [
        "./node_modules/.bin/asar",
        "./node_modules/asar/bin/asar.js"
    ]
    
    for path in local_paths:
        if os.path.exists(path):
            print_verbose(f"Found local asar: {path}")
            return path
    
    # Check global installation
    try:
        subprocess.run(["asar", "--version"], stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True)
        print_verbose("Found global asar")
        return "asar"
    except (subprocess.SubprocessError, FileNotFoundError):
        pass
    
    # Linux-specific paths
    linux_paths = [
        "/usr/local/bin/asar",
        "/usr/bin/asar",
        str(Path.home() / ".npm-global" / "bin" / "asar"),
        str(Path.home() / ".local" / "bin" / "asar"),
    ]
    
    for path in linux_paths:
        if os.path.exists(path):
            print_verbose(f"Found Linux asar: {path}")
            return path
    
    return None

def install_asar_tool_linux():
    """Install asar tool on Linux."""
    print_info("Installing asar tool for Linux...")
    
    # Try different installation methods
    install_methods = [
        ["npm", "install", "--no-save", "asar"],           # Local install
        ["npm", "install", "-g", "asar"],                  # Global install
        ["sudo", "npm", "install", "-g", "asar"],          # Global with sudo
    ]
    
    for method in install_methods:
        try:
            print_verbose(f"Trying: {' '.join(method)}")
            subprocess.run(method, check=True, capture_output=True)
            print_success(f"Successfully installed asar using: {' '.join(method)}")
            
            # Verify installation
            asar_tool = check_asar_tool_linux()
            if asar_tool:
                return asar_tool
                
        except (subprocess.SubprocessError, FileNotFoundError) as e:
            print_verbose(f"Method failed: {e}")
            continue
    
    print_error("Failed to install asar. Try manually:")
    print("  1. Install Node.js: sudo apt install nodejs npm  (Ubuntu/Debian)")
    print("                      sudo yum install nodejs npm   (CentOS/RHEL)")
    print("  2. Install asar: npm install -g asar")
    return None

def find_injection_file(extract_dir):
    """Find the best file for injection."""
    print_info("Searching for injection point...")
    
    # Priority order for Linux (traditional preload files more common)
    file_patterns = [
        "preload.bundle.js",  # Most common on Linux
        "preload.js",         # Alternative preload
        "bundle.js",          # Generic bundle
        "main.bundle.js",     # Main bundle
        "index.js",           # Newer versions
    ]
    
    search_dirs = ["dist", "src", "app", "build", "static", "js", "scripts", ""]
    
    found_files = []
    
    # Search systematically
    for search_dir in search_dirs:
        search_path = os.path.join(extract_dir, search_dir) if search_dir else extract_dir
        if os.path.exists(search_path):
            for pattern in file_patterns:
                file_path = os.path.join(search_path, pattern)
                if os.path.exists(file_path):
                    found_files.append(file_path)
                    print_verbose(f"Found: {file_path}")
    
    # Also do recursive search
    for root, dirs, files in os.walk(extract_dir):
        for file in files:
            if file.endswith('.js') and ('preload' in file.lower() or 'bundle' in file.lower() or file == 'index.js'):
                file_path = os.path.join(root, file)
                if file_path not in found_files:
                    found_files.append(file_path)
                    print_verbose(f"Found additional: {file_path}")
    
    if not found_files:
        print_error("No suitable injection files found!")
        print_info("Available JavaScript files:")
        for root, dirs, files in os.walk(extract_dir):
            for file in files:
                if file.endswith('.js'):
                    rel_path = os.path.relpath(os.path.join(root, file), extract_dir)
                    print(f"  - {rel_path}")
        return None
    
    # Select best file based on priority
    for pattern in file_patterns:
        for file_path in found_files:
            if pattern in os.path.basename(file_path):
                if pattern == "preload.bundle.js":
                    print_success(f"Selected: {file_path} (standard preload)")
                elif pattern == "index.js":
                    print_success(f"Selected: {file_path} (newer Slack version)")
                else:
                    print_success(f"Selected: {file_path} ({pattern})")
                return file_path
    
    # Fallback to first found
    selected = found_files[0]
    print_warning(f"Selected: {selected} (fallback)")
    return selected

def validate_injection_file(file_path, force=False):
    """Validate the injection file."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        if len(content) < 100:
            print_warning(f"File seems small ({len(content)} bytes)")
            if not force:
                response = input("Continue anyway? (y/N): ").strip().lower()
                return response in ['y', 'yes']
        
        # Check for JavaScript/Slack indicators
        js_indicators = ['function', 'const', 'let', 'var', 'require', 'module', 'exports']
        slack_indicators = ['electron', 'preload', 'window', 'slack']
        
        found_js = sum(1 for indicator in js_indicators if indicator in content)
        found_slack = sum(1 for indicator in slack_indicators if indicator.lower() in content.lower())
        
        if found_js >= 3:
            print_success(f"File validation passed ({found_js}/7 JS indicators, {found_slack}/4 Slack indicators)")
            return True
        else:
            print_warning(f"File validation concerns ({found_js}/7 JS indicators, {found_slack}/4 Slack indicators)")
            if force:
                print_warning("Continuing due to --force flag")
                return True
            response = input("Continue anyway? (y/N): ").strip().lower()
            return response in ['y', 'yes']
            
    except Exception as e:
        print_error(f"Error validating file: {e}")
        return False

def inject_scripts(injection_file, config_path, *script_paths):
    """Inject SlackPolish scripts into the target file."""
    try:
        # Read existing content
        with open(injection_file, 'r', encoding='utf-8') as f:
            content = f.read()

        # COMPREHENSIVE CLEANUP - Remove ALL SlackPolish code
        print_info("Performing comprehensive cleanup of all SlackPolish code...")

        # Patterns to remove everything SlackPolish-related
        cleanup_patterns = [
            # Main injection blocks with optional semicolons - more comprehensive
            r'// === SLACKPOLISH INJECTION START ===.*?// === SLACKPOLISH INJECTION END ===;?\s*(?:// === SLACKPOLISH INJECTION END ===;?\s*)*',
            r'// === SLACK TEXT IMPROVER INJECTION START ===.*?// === SLACK TEXT IMPROVER INJECTION END ===;?\s*(?:// === SLACK TEXT IMPROVER INJECTION END ===;?\s*)*',

            # Individual file markers (new structure)
            r'// === SLACK-TEXT-IMPROVER\.JS ===.*?(?=// === |\Z)',
            r'// === SLACK-SETTINGS\.JS ===.*?(?=// === |\Z)',
            r'// === SLACK-CHANNEL-SUMMARY\.JS ===.*?(?=// === |\Z)',
            r'// === LOGO-DATA\.JS ===.*?(?=// === |\Z)',

            # Orphaned end markers - multiple consecutive ones
            r'(?:// === SLACKPOLISH INJECTION END ===;?\s*)+',
            r'(?:// === SLACK TEXT IMPROVER INJECTION END ===;?\s*)+',

            # Config and utilities
            r'window\.SLACKPOLISH_CONFIG\s*=.*?};?',
            r'window\.SlackPolishUtils\s*=.*?};?',
            r'window\.SLACKPOLISH_LOGO_BASE64\s*=.*?;',
            r'window\.SLACKPOLISH_LOGO_DATA\s*=.*?;',

            # Class definitions (old single-file structure)
            r'class SlackTextImprover\s*{.*?}\s*\)\(\);?',
            r'class SlackSettings\s*{.*?}\s*\)\(\);?',
            r'class SlackChannelSummary\s*{.*?}\s*\)\(\);?',

            # Function-based implementations
            r'\(function\(\)\s*{\s*[\'"]use strict[\'"];.*?SlackTextImprover.*?}\)\(\);?',
            r'\(function\(\)\s*{\s*[\'"]use strict[\'"];.*?SlackSettings.*?}\)\(\);?',
            r'\(function\(\)\s*{\s*[\'"]use strict[\'"];.*?SlackChannelSummary.*?}\)\(\);?',

            # Any remaining SlackPolish references
            r'SlackPolish[A-Za-z]*\s*[=:].*?[;}]',
            r'// SlackPolish.*?\n',
            r'/\* SlackPolish.*?\*/',

            # Cleanup any orphaned semicolons or empty lines left behind
            r';\s*;\s*;+',
            r'\n\s*\n\s*\n+',
        ]

        original_length = len(content)

        for i, pattern in enumerate(cleanup_patterns):
            before_length = len(content)
            content = re.sub(pattern, '', content, flags=re.DOTALL | re.MULTILINE)
            after_length = len(content)
            if before_length != after_length:
                print_info(f"  Pattern {i+1}: Removed {before_length - after_length} characters")

        # Additional targeted cleanup for duplicate end markers
        # This handles the specific case of duplicate injection end markers
        duplicate_patterns = [
            r'// === SLACKPOLISH INJECTION END ===;\s*\n\s*// === SLACKPOLISH INJECTION END ===',
            r'// === SLACK TEXT IMPROVER INJECTION END ===;\s*\n\s*// === SLACK TEXT IMPROVER INJECTION END ===',
        ]

        for i, pattern in enumerate(duplicate_patterns):
            before_length = len(content)
            content = re.sub(pattern, '// === SLACKPOLISH INJECTION END ===', content, flags=re.DOTALL | re.MULTILINE)
            after_length = len(content)
            if before_length != after_length:
                print_info(f"  Duplicate cleanup {i+1}: Removed {before_length - after_length} characters")

        # Final cleanup - remove excessive whitespace
        content = re.sub(r'\n\s*\n\s*\n+', '\n\n', content)
        content = re.sub(r';\s*;+', ';', content)

        total_removed = original_length - len(content)
        if total_removed > 0:
            print_success(f"Comprehensive cleanup complete: Removed {total_removed} characters of old code")
        else:
            print_info("No old SlackPolish code found to remove")

        # Read config script
        with open(config_path, 'r', encoding='utf-8') as f:
            config_script = f.read()

        # Read logo data if it exists
        logo_script = ""
        if os.path.exists("logo-data.js"):
            with open("logo-data.js", 'r', encoding='utf-8') as f:
                logo_script = f.read()

        # Read the single text improver script
        text_improver_script = ""
        if os.path.exists('slack-text-improver.js'):
            with open('slack-text-improver.js', 'r', encoding='utf-8') as f:
                text_improver_script = f.read().strip()
                # Ensure script ends with a semicolon
                if not text_improver_script.endswith(';'):
                    text_improver_script += ';'

        # Read the settings script
        settings_script = ""
        if os.path.exists('slack-settings.js'):
            with open('slack-settings.js', 'r', encoding='utf-8') as f:
                settings_script = f.read().strip()
                # Ensure script ends with a semicolon
                if not settings_script.endswith(';'):
                    settings_script += ';'

        # Read the channel summary script
        channel_summary_script = ""
        if os.path.exists('slack-channel-summary.js'):
            with open('slack-channel-summary.js', 'r', encoding='utf-8') as f:
                channel_summary_script = f.read().strip()
                # Ensure script ends with a semicolon
                if not channel_summary_script.endswith(';'):
                    channel_summary_script += ';'

        # Ensure config script ends properly
        config_script = config_script.strip()
        if not config_script.endswith(';'):
            config_script += ';'

        # Ensure logo script ends properly
        if logo_script:
            logo_script = logo_script.strip()
            if not logo_script.endswith(';'):
                logo_script += ';'

        # Ensure proper ending of main content
        if not content.rstrip().endswith(';'):
            content = content.rstrip() + ';\n'

        # Inject scripts with proper separation
        injection = f"""
;
// === SLACKPOLISH INJECTION START ===
{config_script}

{logo_script}

// === SLACK-TEXT-IMPROVER.JS ===
{text_improver_script}

// === SLACK-SETTINGS.JS ===
{settings_script}

// === SLACK-CHANNEL-SUMMARY.JS ===
{channel_summary_script}
// === SLACKPOLISH INJECTION END ===
"""

        content += injection

        # Write back
        with open(injection_file, 'w', encoding='utf-8') as f:
            f.write(content)

        print_success("Scripts injected successfully!")
        return True

    except Exception as e:
        print_error(f"Error injecting scripts: {e}")
        return False

def extract_asar(asar_path, output_dir, asar_tool):
    """Extract ASAR archive."""
    try:
        subprocess.run([asar_tool, "extract", asar_path, output_dir], check=True)
        return True
    except subprocess.SubprocessError:
        return False

def repack_asar(input_dir, asar_path, asar_tool):
    """Repack ASAR archive."""
    try:
        subprocess.run([asar_tool, "pack", input_dir, asar_path], check=True)
        return True
    except subprocess.SubprocessError:
        return False

def parse_arguments():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(
        description="SlackPolish Installer for Linux x64",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  sudo python3 install-slack-LINUX-X64.py                    # Standard installation
  sudo python3 install-slack-LINUX-X64.py -v                # Verbose output
  sudo python3 install-slack-LINUX-X64.py --force           # Force installation
  sudo python3 install-slack-LINUX-X64.py -s true           # Reset settings
        """
    )
    
    parser.add_argument('-s', '--reset-settings', choices=['true', 'false'],
                       help='Reset saved settings (true/false)')
    parser.add_argument('-k', '--reset-api-key', choices=['true', 'false'],
                       help='Reset API key (true/false)')
    parser.add_argument('-v', '--verbose', action='store_true',
                       help='Enable verbose output')
    parser.add_argument('--force', action='store_true',
                       help='Force installation even if validation fails')
    parser.add_argument('--slack-path', help='Specify Slack path manually')
    
    return parser.parse_args()

def main():
    """Main installation function."""
    global VERBOSE
    
    args = parse_arguments()
    VERBOSE = args.verbose
    
    print_header("🐧 SlackPolish Installer for Linux x64")
    
    # Validate platform
    if not detect_linux_system():
        return 1
    
    # Check required files
    required_files = ["slack-config.js", "slack-text-improver.js", "slack-settings.js", "slack-channel-summary.js", "logo-data.js"]
    for file in required_files:
        if not os.path.exists(file):
            print_error(f"Required file not found: {file}")
            return 1
    print_success("All required files found")
    
    # Find Slack installation
    if args.slack_path:
        slack_path = args.slack_path
    else:
        slack_path = find_slack_installation_linux()
    
    if not slack_path:
        print_error("Could not find Slack installation")
        print_info("Common locations:")
        print("  - /usr/lib/slack/resources")
        print("  - /opt/slack/resources")
        print("  - /snap/slack/current/usr/lib/slack/resources")
        print_info("Try: sudo python3 install-slack-LINUX-X64.py --slack-path '/path/to/slack/resources'")
        return 1
    
    # Check asar tool
    asar_tool = check_asar_tool_linux()
    if not asar_tool:
        asar_tool = install_asar_tool_linux()
        if not asar_tool:
            print_error("Could not install asar tool")
            return 1
    print_success(f"asar tool available: {asar_tool}")
    
    # Setup paths
    asar_path = os.path.join(slack_path, "app.asar")
    backup_path = os.path.join(slack_path, "app.asar.backup")
    extract_dir = "slack_temp_extract"
    
    # Create backup
    if not os.path.exists(backup_path):
        print_info("Creating backup...")
        shutil.copy2(asar_path, backup_path)
        print_success("Backup created")
    
    # Extract
    print_info("Extracting app.asar...")
    if os.path.exists(extract_dir):
        shutil.rmtree(extract_dir)
    if not extract_asar(asar_path, extract_dir, asar_tool):
        print_error("Failed to extract app.asar")
        return 1
    
    # Find injection file
    injection_file = find_injection_file(extract_dir)
    if not injection_file:
        print_error("Could not find suitable injection file")
        return 1
    
    # Validate file
    if not validate_injection_file(injection_file, args.force):
        print_error("File validation failed")
        return 1
    
    # Inject scripts
    print_info("Injecting SlackPolish Text Improver...")
    if not inject_scripts(injection_file, "slack-config.js"):
        print_error("Failed to inject scripts")
        return 1
    
    # Repack
    print_info("Repacking app.asar...")
    if not repack_asar(extract_dir, asar_path, asar_tool):
        print_error("Failed to repack app.asar")
        return 1
    
    # Cleanup
    shutil.rmtree(extract_dir)
    
    print_header("🎉 Installation completed successfully!")
    print("Next steps:")
    print("1. Restart Slack")
    print("2. Press F12 to open settings menu and configure your preferences")
    print("3. Press Ctrl+Shift in any message field to test text improvement")
    print("4. Press F10 for channel summary")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
