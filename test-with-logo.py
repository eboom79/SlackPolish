#!/usr/bin/env python3
"""
Test installer: config + logo + text improver
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
    print("🧪 Test Installer: Config + Logo + Text Improver")
    print("=" * 50)
    
    # Check if running as root
    if os.geteuid() != 0:
        print("❌ This script must be run with sudo")
        sys.exit(1)
    
    # Restore from backup first
    if os.path.exists(BACKUP_PATH):
        print("🔍 Restoring from backup...")
        shutil.copy2(BACKUP_PATH, ASAR_PATH)
        print("✅ Restored")
    
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
    
    # Read scripts
    print("🔍 Reading scripts...")
    with open('slack-config.js', 'r', encoding='utf-8') as f:
        config_script = f.read()
    
    with open('logo-data.js', 'r', encoding='utf-8') as f:
        logo_script = f.read()
    
    with open('slack-text-improver.js', 'r', encoding='utf-8') as f:
        text_improver_script = f.read()
    
    # Create injection with logo
    injection = f"""
;
// === SLACKPOLISH TEST INJECTION START ===
{config_script}

{logo_script}

// === SLACK-TEXT-IMPROVER.JS ===
{text_improver_script}
// === SLACKPOLISH TEST INJECTION END ===
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
    print("🎉 TEST INSTALLATION COMPLETE!")
    print("=" * 50)
    print("\nThis installation includes:")
    print("  ✅ slack-config.js")
    print("  ✅ logo-data.js")
    print("  ✅ slack-text-improver.js")
    print("  ❌ slack-settings.js (excluded)")
    print("  ❌ slack-channel-summary.js (excluded)")

if __name__ == "__main__":
    main()

