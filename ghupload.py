#!/usr/bin/env python3
"""
Dumb script to upload labels to a GitHub repo from a text file.

Usage:
    python upload_labels.py labels.txt

Input file format (blank line between each label):

    bug  #D73A4A
    Type
    Something is broken or not working as expected
    PDF export cuts off bottom of canvas

Line 1: label name and hex color
Line 2: ignored (always "Type")
Line 3+: description (multiple lines are joined with a space)

Set GITHUB_TOKEN and GITHUB_REPO as environment variables:
    export GITHUB_TOKEN=ghp_yourtoken
    export GITHUB_REPO=owner/repo
"""

import os
import sys
import requests

GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "your_token_here")
REPO = os.getenv("GITHUB_REPO", "jfisher94002/TrafficControlPlanner")

BASE_URL = f"https://api.github.com/repos/{REPO}/labels"
HEADERS = {
    "Authorization": f"Bearer {GITHUB_TOKEN}",
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
}

def load_labels(filepath):
    with open(filepath) as f:
        lines = [l.rstrip() for l in f if l.strip()]

    labels = []
    i = 0
    while i < len(lines):
        # Skip header/section lines (no # color on this line)
        if '#' not in lines[i]:
            i += 1
            continue

        # Need at least 3 more lines after this one
        if i + 3 >= len(lines):
            break

        #name_color = lines[i].split()
        #name  = name_color[0]
        #color = name_color[-1].lstrip("#")  # use last token in case name has spaces
        last_hash = lines[i].rfind('#')
        name  = lines[i][:last_hash].strip()
        color = lines[i][last_hash+1:].strip()

        # lines[i+1] is category ("Type", "Priority", etc.) — ignored
        description = f"{lines[i+2]} {lines[i+3]}"[:100]

        labels.append({"name": name, "color": color, "description": description})
        i += 4

    return labels

def upload_labels(labels):
    for label in labels:
        resp = requests.post(BASE_URL, json=label, headers=HEADERS)
        print(f"  DEBUG POST: {resp.status_code} {resp.text}")
        if resp.status_code == 201:
            print(f"  ✓ Created: {label['name']}")
        elif resp.status_code == 422:
            error = resp.json()
            errors = error.get("errors", [])
            if any(e.get("code") == "already_exists" for e in errors):
                # Label exists, update it
                update_url = f"{BASE_URL}/{requests.utils.quote(label['name'])}"
                resp2 = requests.patch(update_url, json=label, headers=HEADERS)
                if resp2.status_code == 200:
                    print(f"  ↻ Updated: {label['name']}")
                else:
                    print(f"  ✗ Failed to update {label['name']}: {resp2.text}")
            else:
                print(f"  ✗ Validation error for {label['name']}: {resp.text}")

if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("Usage: python upload_labels.py <labels_file>")
        sys.exit(1)

    filepath = sys.argv[1]
    labels = load_labels(filepath)
    print(f"Uploading {len(labels)} labels to {REPO}...\n")
    upload_labels(labels)
    print("\nDone.")
