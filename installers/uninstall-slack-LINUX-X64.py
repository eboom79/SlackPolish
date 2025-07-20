#!/usr/bin/env python3
"""
SlackPolish Uninstaller
Completely removes SlackPolish and restores original Slack
"""

import os
import sys
import subprocess
import shutil
import argparse

def print_error(message):
    print(f"❌ {message}")

def print_success(message):
    print(f"✅ {message}")

def print_info(message):
    print(f"🔍 {message}")

def print_header(message):
    print(f"\n{'='*50}")
    print(f"🗑️ {message}")
    print(f"{'='*50}\n")

def find_slack_installation():
    """Find Slack installation directory."""
    common_paths = [
        "/usr/lib/slack/resources",
        "/opt/slack/resources", 
        "/snap/slack/current/usr/lib/slack/resources",
        "/var/lib/snapd/snap/slack/current/usr/lib/slack/resources"
    ]
    
    for path in common_paths:
        if os.path.exists(os.path.join(path, "app.asar")):
            return path
    
    return None

def backup_exists(slack_path):
    """Check if original backup exists."""
    backup_path = os.path.join(slack_path, "app.asar.backup")
    return os.path.exists(backup_path)

def restore_original_asar(slack_path):
    """Restore the original app.asar from backup."""
    try:
        asar_path = os.path.join(slack_path, "app.asar")
        backup_path = os.path.join(slack_path, "app.asar.backup")

        if not backup_exists(slack_path):
            print_error("No original backup found (app.asar.backup)")
            print_info("This means either:")
            print_info("  1. SlackPolish was never installed")
            print_info("  2. The backup was deleted")
            print_info("  3. You need to reinstall Slack completely")
            return False
        
        print_info("Restoring original app.asar from backup...")
        
        # Remove current (modified) app.asar
        if os.path.exists(asar_path):
            os.remove(asar_path)
        
        # Restore from backup
        shutil.copy2(backup_path, asar_path)
        
        print_success("Original app.asar restored successfully!")
        return True
        
    except Exception as e:
        print_error(f"Error restoring original asar: {e}")
        return False

def cleanup_backup(slack_path):
    """Remove the backup file after successful restoration."""
    try:
        backup_path = os.path.join(slack_path, "app.asar.backup")
        if os.path.exists(backup_path):
            os.remove(backup_path)
            print_success("Backup file cleaned up")
        return True
    except Exception as e:
        print_error(f"Error cleaning up backup: {e}")
        return False

def main():
    parser = argparse.ArgumentParser(description="Uninstall SlackPolish and restore original Slack")
    parser.add_argument("--slack-path", help="Path to Slack resources directory")
    parser.add_argument("--keep-backup", action="store_true", help="Keep the original backup file")
    args = parser.parse_args()

    print_header("SlackPolish Uninstaller")
    
    # Find Slack installation
    if args.slack_path:
        slack_path = args.slack_path
    else:
        print_info("Searching for Slack installation...")
        slack_path = find_slack_installation()
    
    if not slack_path:
        print_error("Slack installation not found!")
        print_info("Please specify the path manually with --slack-path")
        return 1
    
    print_success(f"Found Slack at: {slack_path}")
    
    # Check if backup exists
    if not backup_exists(slack_path):
        print_error("No SlackPolish installation found to uninstall")
        print_info("app.asar.original backup file not found")
        return 1
    
    print_info("Found SlackPolish installation (backup exists)")

    # Confirm uninstallation
    print("\n⚠️  This will:")
    print("   1. Restore the original Slack app.asar from app.asar.backup")
    print("   2. Remove all SlackPolish modifications")
    print("   3. Require you to restart Slack")
    
    if not args.keep_backup:
        print("   4. Delete the backup file")
    
    response = input("\nProceed with uninstallation? (y/N): ")
    if response.lower() != 'y':
        print_info("Uninstallation cancelled")
        return 0
    
    # Restore original asar
    if not restore_original_asar(slack_path):
        print_error("Failed to restore original asar")
        return 1
    
    # Cleanup backup (unless user wants to keep it)
    if not args.keep_backup:
        cleanup_backup(slack_path)
    else:
        print_info("Keeping backup file as requested")
    
    print_header("🎉 Uninstallation completed successfully!")
    print("SlackPolish has been completely removed.")
    print("Please restart Slack to use the original version.")
    print("\nTo reinstall SlackPolish later, run the installer again.")
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
