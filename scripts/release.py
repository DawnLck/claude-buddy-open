#!/usr/bin/env python3
import sys
import os
import json
import subprocess
from pathlib import Path

def get_current_version():
    version_file = Path("VERSION")
    if not version_file.exists():
        return "0.0.0"
    return version_file.read_text().strip()

def bump_version(current, type="patch"):
    major, minor, patch = map(int, current.split("."))
    if type == "major":
        major += 1
        minor = 0
        patch = 0
    elif type == "minor":
        minor += 1
        patch = 0
    else:  # patch
        patch += 1
    return f"{major}.{minor}.{patch}"

def update_version_file(new_version):
    Path("VERSION").write_text(new_version + "\n")
    print(f"Updated VERSION to {new_version}")

def update_package_json(new_version):
    pjson_path = Path("package.json")
    if not pjson_path.exists():
        return
    with open(pjson_path, "r") as f:
        data = json.load(f)
    
    old_version = data.get("version", "0.0.0")
    data["version"] = new_version
    
    with open(pjson_path, "w") as f:
        json.dump(data, f, indent=2)
        f.write("\n")
    print(f"Updated package.json: {old_version} -> {new_version}")

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 release.py [patch|minor|major|current] [--dry-run]")
        sys.exit(1)

    bump_type = sys.argv[1]
    dry_run = "--dry-run" in sys.argv
    
    current = get_current_version()
    
    if bump_type == "current":
        new_version = current
    else:
        new_version = bump_version(current, bump_type)

    print(f"Current version: {current}")
    print(f"Target version: {new_version}")
    
    if dry_run:
        print("[Dry Run] No files modified.")
        print(f"[Dry Run] Suggested command: git add VERSION package.json && git commit -m 'Release v{new_version}' && git tag v{new_version}")
        return

    update_version_file(new_version)
    update_package_json(new_version)
    
    print("\nNext steps:")
    print(f"1. git add VERSION package.json")
    print(f"2. git commit -m 'Release v{new_version}'")
    print(f"3. git tag v{new_version}")
    print(f"4. git push origin main --tags")

if __name__ == "__main__":
    main()
