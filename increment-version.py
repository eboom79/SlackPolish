#!/usr/bin/env python3
"""
SlackPolish Version Manager
Manages version numbers for SlackPolish releases

Usage:
  python3 increment-version.py                    # Increment build number by 1
  python3 increment-version.py 1.2.0             # Set specific version
  python3 increment-version.py 1.2.0 "Release"  # Set version with description
  python3 increment-version.py "Bug fixes"       # Increment build with description
"""

import json
import re
import sys
from datetime import datetime

def load_version():
    """Load version from version.json file."""
    try:
        with open('version.json', 'r') as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {
            "major": 1,
            "minor": 0,
            "build": 0,
            "version_string": "1.0.0",
            "description": "",
            "date": datetime.now().strftime("%Y-%m-%d")
        }

def parse_version_string(version_str):
    """Parse version string in format major.minor.build"""
    try:
        parts = version_str.split('.')
        if len(parts) != 3:
            raise ValueError("Version must be in format major.minor.build")

        major, minor, build = map(int, parts)
        return major, minor, build
    except (ValueError, TypeError) as e:
        raise ValueError(f"Invalid version format '{version_str}': {e}")

def is_version_string(text):
    """Check if text looks like a version string (major.minor.build)"""
    if not text:
        return False
    try:
        parts = text.split('.')
        if len(parts) != 3:
            return False
        # Try to convert all parts to integers
        list(map(int, parts))
        return True
    except (ValueError, TypeError):
        return False

def increment_build(description="Code changes"):
    """Increment build number and update all relevant files."""
    # Load current version
    version = load_version()

    # Increment build
    version["build"] += 1
    version["version_string"] = f"{version['major']}.{version['minor']}.{version['build']}"
    version["description"] = description
    version["date"] = datetime.now().strftime("%Y-%m-%d")

    # Save and update files
    save_version(version)

    print(f"✅ Version incremented to {version['version_string']}")
    print(f"📝 Description: {description}")
    print(f"📅 Date: {version['date']}")

    return version

def set_version(version_string, description="Version update"):
    """Set specific version and update all relevant files."""
    # Parse version string
    major, minor, build = parse_version_string(version_string)

    # Create version object
    version = {
        "major": major,
        "minor": minor,
        "build": build,
        "version_string": version_string,
        "description": description,
        "date": datetime.now().strftime("%Y-%m-%d")
    }

    # Save and update files
    save_version(version)

    print(f"✅ Version set to {version['version_string']}")
    print(f"📝 Description: {description}")
    print(f"📅 Date: {version['date']}")

    return version

def save_version(version):
    """Save version to files and update config."""
    # Save version.json
    with open('version.json', 'w') as f:
        json.dump(version, f, indent=4)

    # Update slack-config.js
    update_config_file(version)

def update_config_file(version):
    """Update version info in slack-config.js"""
    try:
        with open('slack-config.js', 'r') as f:
            content = f.read()
        
        # Update version fields
        content = re.sub(r'VERSION: "[^"]*"', f'VERSION: "{version["version_string"]}"', content)
        content = re.sub(r'BUILD: \d+', f'BUILD: {version["build"]}', content)
        content = re.sub(r'BUILD_DATE: "[^"]*"', f'BUILD_DATE: "{version["date"]}"', content)
        content = re.sub(r'DESCRIPTION: "[^"]*"', f'DESCRIPTION: "{version["description"]}"', content)
        
        with open('slack-config.js', 'w') as f:
            f.write(content)
        
        print(f"✅ Updated slack-config.js with version {version['version_string']}")
        
    except Exception as e:
        print(f"❌ Error updating slack-config.js: {e}")

if __name__ == "__main__":
    if len(sys.argv) == 1:
        # No arguments - increment build number
        increment_build()

    elif len(sys.argv) == 2:
        arg = sys.argv[1]
        if is_version_string(arg):
            # Single argument is version string
            set_version(arg)
        else:
            # Single argument is description
            increment_build(arg)

    elif len(sys.argv) == 3:
        arg1, arg2 = sys.argv[1], sys.argv[2]
        if is_version_string(arg1):
            # First arg is version, second is description
            set_version(arg1, arg2)
        else:
            # Both args are description
            description = " ".join(sys.argv[1:])
            increment_build(description)

    else:
        # Multiple arguments - treat as description
        description = " ".join(sys.argv[1:])
        increment_build(description)
