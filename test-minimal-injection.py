#!/usr/bin/env python3
"""
Minimal test injection to diagnose Slack v4.47.69 compatibility issue
"""

import os
import sys
import subprocess
import shutil

def run_command(cmd, check=True):
    """Run a shell command"""
    print(f"Running: {cmd}")
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if check and result.returncode != 0:
        print(f"Error: {result.stderr}")
        sys.exit(1)
    return result

def main():
    slack_resources = "/usr/lib/slack/resources"
    app_asar = f"{slack_resources}/app.asar"
    app_asar_backup = f"{app_asar}.backup"
    extract_dir = "/tmp/slack_test_inject"
    asar_tool = "./node_modules/.bin/asar"
    
    print("=" * 60)
    print("MINIMAL INJECTION TEST FOR SLACK v4.47.69")
    print("=" * 60)
    
    # Kill Slack
    print("\n1. Killing Slack...")
    run_command("killall slack", check=False)
    
    # Create backup if doesn't exist
    if not os.path.exists(app_asar_backup):
        print("\n2. Creating backup...")
        run_command(f"sudo cp {app_asar} {app_asar_backup}")
    else:
        print("\n2. Backup already exists, restoring...")
        run_command(f"sudo cp {app_asar_backup} {app_asar}")
    
    # Extract
    print("\n3. Extracting app.asar...")
    if os.path.exists(extract_dir):
        shutil.rmtree(extract_dir)
    run_command(f"sudo {asar_tool} extract {app_asar} {extract_dir}")
    
    # Inject minimal test code
    print("\n4. Injecting minimal test code...")
    preload_file = f"{extract_dir}/dist/preload.bundle.js"
    
    minimal_code = """
// === MINIMAL SLACKPOLISH TEST ===
console.log('SlackPolish: Minimal injection test - START');
try {
    window.SLACKPOLISH_TEST = {
        version: 'test-minimal',
        injected: true,
        timestamp: new Date().toISOString()
    };
    console.log('SlackPolish: Minimal injection test - SUCCESS');
} catch (error) {
    console.error('SlackPolish: Minimal injection test - ERROR:', error);
}
// === END MINIMAL TEST ===
"""
    
    with open(preload_file, 'r') as f:
        content = f.read()

    # Find the injection point - BEFORE the closing })(); of the main IIFE
    # Search for the pattern: })(); followed by whitespace and then sourcemap
    sourcemap_marker = "//# sourceMappingURL="

    if sourcemap_marker in content:
        import re
        # Pattern: })(); followed by any whitespace (including newlines) and then sourcemap comment
        pattern = r'(\}\)\(\);)\s*(//# sourceMappingURL=)'

        # Find ALL matches and use the last one
        matches = list(re.finditer(pattern, content))

        if matches:
            # Use the LAST match (Slack's main IIFE closing before sourcemap)
            last_match = matches[-1]
            inject_pos = last_match.start(1)
            new_content = content[:inject_pos] + "\n" + minimal_code + "\n" + content[inject_pos:]
        else:
            # Fallback: inject before sourcemap if we can't find the pattern
            sourcemap_idx = content.rfind(sourcemap_marker)
            new_content = content[:sourcemap_idx] + minimal_code + "\n" + content[sourcemap_idx:]
    else:
        print("ERROR: Could not find sourcemap marker in preload.bundle.js")
        sys.exit(1)
    
    with open(preload_file, 'w') as f:
        f.write(new_content)
    
    print(f"   Injected {len(minimal_code)} bytes of test code")
    
    # Repack
    print("\n5. Repacking app.asar...")
    run_command(f"sudo {asar_tool} pack {extract_dir} {app_asar}")
    
    # Cleanup
    print("\n6. Cleaning up...")
    shutil.rmtree(extract_dir)
    
    print("\n" + "=" * 60)
    print("MINIMAL INJECTION COMPLETE")
    print("=" * 60)
    print("\nNow starting Slack...")
    print("Check the browser console (Ctrl+Shift+I) for:")
    print("  - 'SlackPolish: Minimal injection test - START'")
    print("  - 'SlackPolish: Minimal injection test - SUCCESS'")
    print("\nOr check for errors if Slack crashes.")
    print("\nStarting Slack in 3 seconds...")
    
    import time
    time.sleep(3)
    
    # Start Slack
    run_command("slack &", check=False)
    
    print("\nSlack started. Monitor for crashes or check console.")

if __name__ == "__main__":
    if os.geteuid() != 0:
        print("This script needs sudo privileges. Running with sudo...")
        os.execvp("sudo", ["sudo", "python3"] + sys.argv)
    main()

