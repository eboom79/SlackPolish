#!/usr/bin/env python3
"""
SlackPolish Installer for macOS ARM (Apple Silicon M1/M2/M3)
Optimized for Apple Silicon Macs and newer Slack versions
"""

import os
import sys
import subprocess
import shutil
import re
import argparse
from pathlib import Path
import time
import glob

# ANSI colors
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

def detect_mac_architecture():
    """Detect Mac architecture and validate it's ARM."""
    import platform
    
    system = platform.system()
    machine = platform.machine().lower()
    
    if system != "Darwin":
        print_error("This installer is specifically for macOS. Detected: " + system)
        print_info("Use install-slack-LINUX-X64.py for Linux or install-slack-WINDOWS-X64.py for Windows")
        return False
    
    if machine not in ["arm64", "aarch64"]:
        print_warning(f"This installer is optimized for Apple Silicon (ARM). Detected: {machine}")
        print_info("For Intel Macs, consider using the standard installer")
        response = input("Continue anyway? (y/N): ").strip().lower()
        if response not in ['y', 'yes']:
            return False
    
    print_success(f"✅ Apple Silicon Mac detected ({machine})")
    return True

def find_slack_installation_mac():
    """Find Slack installation on macOS with ARM-specific paths."""
    print_info("Searching for Slack installation on macOS...")
    
    # ARM Mac specific paths (prioritized)
    possible_paths = [
        "/Applications/Slack.app/Contents/Resources",
        str(Path.home() / "Applications" / "Slack.app" / "Contents" / "Resources"),
        "/opt/homebrew/Caskroom/slack/*/Slack.app/Contents/Resources",  # Homebrew ARM
    ]
    
    # Expand glob patterns
    expanded_paths = []
    for path in possible_paths:
        if "*" in path:
            expanded_paths.extend(glob.glob(path))
        else:
            expanded_paths.append(path)
    
    for path in expanded_paths:
        print_verbose(f"Checking: {path}")
        if os.path.exists(path) and os.path.isfile(os.path.join(path, "app.asar")):
            print_success(f"Found Slack at: {path}")
            return path
        else:
            print_verbose(f"   ❌ Not found")
    
    return None

def check_asar_tool_mac():
    """Check for asar tool with ARM Mac specific paths."""
    print_verbose("Checking for asar tool on ARM Mac...")
    
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
    
    # ARM Mac specific paths (Homebrew)
    arm_paths = [
        "/opt/homebrew/bin/asar",
        "/opt/homebrew/lib/node_modules/asar/bin/asar.js",
        str(Path.home() / ".npm-global" / "bin" / "asar"),
    ]
    
    for path in arm_paths:
        if os.path.exists(path):
            print_verbose(f"Found ARM asar: {path}")
            return path
    
    return None

def install_asar_tool_mac():
    """Install asar tool using ARM Mac package managers."""
    print_info("Installing asar tool for ARM Mac...")
    
    # Try Homebrew npm first (most common on ARM Macs)
    install_methods = [
        ["/opt/homebrew/bin/npm", "install", "--no-save", "asar"],
        ["npm", "install", "--no-save", "asar"],
        ["/opt/homebrew/bin/npm", "install", "-g", "asar"],
        ["npm", "install", "-g", "asar"],
    ]
    
    for method in install_methods:
        try:
            print_verbose(f"Trying: {' '.join(method)}")
            subprocess.run(method, check=True, capture_output=True)
            print_success(f"Successfully installed asar using: {method[0]}")
            
            # Verify installation
            asar_tool = check_asar_tool_mac()
            if asar_tool:
                return asar_tool
                
        except (subprocess.SubprocessError, FileNotFoundError) as e:
            print_verbose(f"Method failed: {e}")
            continue
    
    print_error("Failed to install asar. For ARM Macs, try:")
    print("  1. Install Homebrew: /bin/bash -c \"$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\"")
    print("  2. Install Node.js: brew install node")
    print("  3. Install asar: npm install -g asar")
    return None

def find_injection_file(extract_dir):
    """Find the best file for injection (prioritizing index.js for newer Slack versions)."""
    print_info("Searching for injection point...")
    
    # Priority order for ARM Mac / newer Slack versions
    file_patterns = [
        "index.js",           # Newer Slack versions (4.44.65+)
        "preload.bundle.js",  # Traditional preload
        "preload.js",         # Alternative preload
        "bundle.js",          # Generic bundle
        "main.bundle.js",     # Main bundle
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
        return None
    
    # Select best file based on priority
    for pattern in file_patterns:
        for file_path in found_files:
            if pattern in os.path.basename(file_path):
                if pattern == "index.js":
                    print_success(f"Selected: {file_path} (newer Slack version)")
                else:
                    print_success(f"Selected: {file_path} ({pattern})")
                return file_path
    
    # Fallback to first found
    selected = found_files[0]
    print_warning(f"Selected: {selected} (fallback)")
    return selected

def validate_injection_file(file_path, force=False):
    """Validate the injection file with ARM Mac considerations."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        if len(content) < 100:
            print_warning(f"File seems small ({len(content)} bytes)")
            if not force:
                response = input("Continue anyway? (y/N): ").strip().lower()
                return response in ['y', 'yes']
        
        # Check for JavaScript indicators
        js_indicators = ['function', 'const', 'let', 'var', 'require', 'module', 'exports']
        found_indicators = sum(1 for indicator in js_indicators if indicator in content)
        
        if found_indicators >= 3:
            print_success(f"File validation passed ({found_indicators}/7 JS indicators)")
            return True
        else:
            print_warning(f"File validation concerns ({found_indicators}/7 JS indicators)")
            if force:
                print_warning("Continuing due to --force flag")
                return True
            response = input("Continue anyway? (y/N): ").strip().lower()
            return response in ['y', 'yes']
            
    except Exception as e:
        print_error(f"Error validating file: {e}")
        return False

def inject_scripts(injection_file, config_path, script_path):
    """Inject SlackPolish scripts into the target file."""
    try:
        # Read existing content
        with open(injection_file, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Remove any existing SlackPolish injections
        patterns = [
            r'// === SLACKPOLISH INJECTION START ===.*?// === SLACKPOLISH INJECTION END ===',
            r'// === SLACK TEXT IMPROVER INJECTION START ===.*?// === SLACK TEXT IMPROVER INJECTION END ==='
        ]
        
        for pattern in patterns:
            content = re.sub(pattern, '', content, flags=re.DOTALL)
        
        # Read scripts
        with open(config_path, 'r', encoding='utf-8') as f:
            config_script = f.read()

        # Read logo data if it exists
        logo_script = ""
        if os.path.exists("logo-data.js"):
            with open("logo-data.js", 'r', encoding='utf-8') as f:
                logo_script = f.read()

        with open(script_path, 'r', encoding='utf-8') as f:
            main_script = f.read()
        
        # Ensure proper ending
        if not content.rstrip().endswith(';'):
            content = content.rstrip() + ';\n'
        
        # Inject scripts
        injection = f"""
;
// === SLACKPOLISH INJECTION START ===
{config_script}

{logo_script}

{main_script}
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
        description="SlackPolish Installer for macOS ARM (Apple Silicon)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python3 install-slack-MAC-ARM.py                    # Standard installation
  python3 install-slack-MAC-ARM.py -v                # Verbose output
  python3 install-slack-MAC-ARM.py --force           # Force installation
  python3 install-slack-MAC-ARM.py -s true           # Reset settings
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
    
    print_header("🍎 SlackPolish Installer for macOS ARM")

    # Safety warning for untested installer
    print("\n⚠️  IMPORTANT WARNING ⚠️")
    print("This macOS installer has NOT been tested and may break your Slack installation.")
    print("Only the Linux installer has been verified to work safely.")
    print("Proceeding may damage your Slack app and require reinstallation.")
    print("\nRecommendations:")
    print("- Create a backup of your Slack app before proceeding")
    print("- Ensure you can reinstall Slack if something goes wrong")
    print("- Consider using a test environment first")

    try:
        response = input("\nDo you want to proceed at your own risk? (y/N): ").strip().lower()
        if response not in ['y', 'yes']:
            print("❌ Installation cancelled for safety.")
            print("💡 Consider using the tested Linux installer or waiting for macOS testing.")
            return 0
    except KeyboardInterrupt:
        print("\n❌ Installation cancelled by user.")
        return 0

    print("\n⚠️  You chose to proceed at your own risk. Continuing...")
    print("="*50)

    # Validate platform
    if not detect_mac_architecture():
        return 1
    
    # Check required files
    required_files = ["slack-config.js", "slack-text-improver.js", "logo-data.js"]
    for file in required_files:
        if not os.path.exists(file):
            print_error(f"Required file not found: {file}")
            return 1
    print_success("All required files found")
    
    # Find Slack installation
    if args.slack_path:
        slack_path = args.slack_path
        if slack_path.endswith('.app'):
            slack_path = os.path.join(slack_path, 'Contents', 'Resources')
    else:
        slack_path = find_slack_installation_mac()
    
    if not slack_path:
        print_error("Could not find Slack installation")
        print_info("Try: python3 install-slack-MAC-ARM.py --slack-path '/Applications/Slack.app'")
        return 1
    
    # Check asar tool
    asar_tool = check_asar_tool_mac()
    if not asar_tool:
        asar_tool = install_asar_tool_mac()
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
    print_info("Injecting SlackPolish...")
    if not inject_scripts(injection_file, "slack-config.js", "slack-text-improver.js"):
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
