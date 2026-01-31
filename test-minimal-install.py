#!/usr/bin/env python3
"""
Minimal SlackPolish installer for testing - only injects config + text improver
"""

import os
import sys
import subprocess
import shutil

# Paths
SLACK_RESOURCES = "/usr/lib/slack/resources"
ASAR_PATH = os.path.join(SLACK_RESOURCES, "app.asar")
BACKUP_PATH = ASAR_PATH + ".backup"
ASAR_TOOL = "./node_modules/.bin/asar"
TEMP_EXTRACT = "slack_temp_extract"

def run_command(cmd, check=True):
    """Run a shell command"""
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if check and result.returncode != 0:
        print(f"❌ Command failed: {cmd}")
        print(f"Error: {result.stderr}")
        sys.exit(1)
    return result

def main():
    print("=" * 50)
    print("🧪 MINIMAL SlackPolish Test Installer")
    print("=" * 50)
    
    # Check if running as root
    if os.geteuid() != 0:
        print("❌ This script must be run with sudo")
        sys.exit(1)
    
    # Create backup
    if not os.path.exists(BACKUP_PATH):
        print("🔍 Creating backup...")
        shutil.copy2(ASAR_PATH, BACKUP_PATH)
        print("✅ Backup created")
    else:
        print("ℹ️  Backup already exists")
    
    # Extract
    print("🔍 Extracting app.asar...")
    if os.path.exists(TEMP_EXTRACT):
        shutil.rmtree(TEMP_EXTRACT)
    run_command(f"{ASAR_TOOL} extract {ASAR_PATH} {TEMP_EXTRACT}")
    print("✅ Extracted")
    
    # Read the preload file
    preload_path = os.path.join(TEMP_EXTRACT, "dist", "preload.bundle.js")
    print(f"🔍 Reading {preload_path}...")
    with open(preload_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Read config script
    print("🔍 Reading slack-config.js...")
    with open('slack-config.js', 'r', encoding='utf-8') as f:
        config_script = f.read()
    
    # Read text improver script
    print("🔍 Reading slack-text-improver.js...")
    with open('slack-text-improver.js', 'r', encoding='utf-8') as f:
        text_improver_script = f.read()
    
    # Create minimal injection (ONLY config + text improver)
    injection = f"""
;
// === SLACKPOLISH MINIMAL TEST INJECTION START ===
{config_script}

// === SLACK-TEXT-IMPROVER.JS ===
{text_improver_script}
// === SLACKPOLISH MINIMAL TEST INJECTION END ===
"""
    
    print(f"📊 Injection size: {len(injection):,} bytes")
    
    # Find sourcemap and inject
    sourcemap_marker = "//# sourceMappingURL="
    
    if sourcemap_marker in content:
        sourcemap_pos = content.rfind(sourcemap_marker)
        before_sourcemap = content[:sourcemap_pos]
        before_sourcemap_stripped = before_sourcemap.rstrip()
        
        if before_sourcemap_stripped.endswith("})();"):
            whitespace_before_sourcemap = before_sourcemap[len(before_sourcemap_stripped):]
            content = before_sourcemap_stripped + "\n" + injection + whitespace_before_sourcemap + content[sourcemap_pos:]
            print("✅ Injected before sourcemap")
        else:
            print("❌ Unexpected file structure")
            sys.exit(1)
    else:
        print("❌ No sourcemap found")
        sys.exit(1)
    
    # Write modified file
    print("🔍 Writing modified file...")
    with open(preload_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print("✅ File written")
    
    # Repack
    print("🔍 Repacking app.asar...")
    if os.path.exists(ASAR_PATH):
        os.remove(ASAR_PATH)
    run_command(f"{ASAR_TOOL} pack {TEMP_EXTRACT} {ASAR_PATH}")
    print("✅ Repacked")
    
    # Cleanup
    print("🔍 Cleaning up...")
    shutil.rmtree(TEMP_EXTRACT)
    print("✅ Cleanup complete")
    
    print("\n" + "=" * 50)
    print("🎉 MINIMAL TEST INSTALLATION COMPLETE!")
    print("=" * 50)
    print("\nThis installation includes:")
    print("  ✅ slack-config.js")
    print("  ✅ slack-text-improver.js")
    print("  ❌ logo-data.js (excluded)")
    print("  ❌ slack-settings.js (excluded)")
    print("  ❌ slack-channel-summary.js (excluded)")
    print("\nNow start Slack and test!")

if __name__ == "__main__":
    main()

