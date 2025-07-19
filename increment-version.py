#!/usr/bin/env python3
"""
SlackPolish Version Incrementer
Increments build number when code changes are made
"""

import json
import re
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

def increment_build(description="Code changes"):
    """Increment build number and update all relevant files."""
    # Load current version
    version = load_version()
    
    # Increment build
    version["build"] += 1
    version["version_string"] = f"{version['major']}.{version['minor']}.{version['build']}"
    version["description"] = description
    version["date"] = datetime.now().strftime("%Y-%m-%d")
    
    # Save version.json
    with open('version.json', 'w') as f:
        json.dump(version, f, indent=4)
    
    # Update slack-config.js
    update_config_file(version)
    
    print(f"✅ Version incremented to {version['version_string']}")
    print(f"📝 Description: {description}")
    print(f"📅 Date: {version['date']}")
    
    return version

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
    import sys
    
    description = "Code changes"
    if len(sys.argv) > 1:
        description = " ".join(sys.argv[1:])
    
    increment_build(description)
