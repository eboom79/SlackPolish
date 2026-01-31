#!/usr/bin/env python3
"""
Test installer with ALL components including minified channel summary
"""

import os
import shutil
import subprocess

# Paths
ASAR_PATH = "/usr/lib/slack/resources/app.asar"
BACKUP_PATH = "/usr/lib/slack/resources/app.asar.backup"
TEMP_EXTRACT = "slack_temp_extract"
ASAR_TOOL = "./node_modules/.bin/asar"

def run_command(cmd):
    """Run shell command"""
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"❌ Error: {result.stderr}")
        return False
    return True

def main():
    print("=" * 50)
    print("🧪 Test: ALL Components + Minified Channel Summary")
    print("=" * 50)
    
    # Backup if needed
    if not os.path.exists(BACKUP_PATH):
        print("🔍 Creating backup...")
        shutil.copy2(ASAR_PATH, BACKUP_PATH)
        print("✅ Backup created")
    else:
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
    
    with open('slack-settings.js', 'r', encoding='utf-8') as f:
        settings_script = f.read()
    
    # Read MINIFIED channel summary
    with open('slack-channel-summary.min.js', 'r', encoding='utf-8') as f:
        channel_summary_script = f.read()
    
    # Create injection with ALL components
    injection = f"""
;
// === SLACKPOLISH FULL INJECTION START ===
{config_script}

{logo_script}

// === SLACK-TEXT-IMPROVER.JS ===
{text_improver_script}

// === SLACK-SETTINGS.JS ===
{settings_script}

// === SLACK-CHANNEL-SUMMARY.JS (MINIFIED) ===
{channel_summary_script}
// === SLACKPOLISH FULL INJECTION END ===
"""
    
    print(f"📊 Injection size: {len(injection):,} bytes")
    
    # Find sourcemap and inject
    sourcemap_marker = "//# sourceMappingURL="
    
    if sourcemap_marker in content:
        sourcemap_pos = content.rfind(sourcemap_marker)
        before_sourcemap = content[:sourcemap_pos]
        sourcemap_line = content[sourcemap_pos:]
        
        # Inject BEFORE sourcemap
        modified_content = before_sourcemap + injection + "\n" + sourcemap_line
        print("✅ Injected before sourcemap")
    else:
        # No sourcemap, inject at end
        modified_content = content + injection
        print("✅ Injected at end")
    
    # Write modified file
    print("🔍 Writing modified file...")
    with open(preload_path, 'w', encoding='utf-8') as f:
        f.write(modified_content)
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
    print("🎉 FULL INSTALLATION COMPLETE!")
    print("=" * 50)
    print("\nThis installation includes:")
    print("  ✅ slack-config.js")
    print("  ✅ logo-data.js")
    print("  ✅ slack-text-improver.js")
    print("  ✅ slack-settings.js")
    print("  ✅ slack-channel-summary.js (MINIFIED)")
    print("\nAll features should now work:")
    print("  - Text Improvement: Ctrl+Shift")
    print("  - Settings: F12")
    print("  - Channel Summary: F10")

if __name__ == "__main__":
    main()

