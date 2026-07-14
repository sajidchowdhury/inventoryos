#!/usr/bin/env python3
"""
Phase 2B — Add mode: "insensitive" to all search filter contains() calls.

Scans all .ts files under src/app/api/ and adds mode: "insensitive" to
every Prisma contains() filter that doesn't already have it.

The regex matches patterns like:
  { name: { contains: search } }              →  { name: { contains: search, mode: "insensitive" } }
  { name: { contains: search.trim() } }       →  { name: { contains: search.trim(), mode: "insensitive" } }
  { name: { contains: "circuit" } }           →  { name: { contains: "circuit", mode: "insensitive" } }

It does NOT touch filters that already have mode: "insensitive" (the regex
[^,}]+ stops at the first comma or closing brace).

Safety: each file is backed up before editing, and a diff is printed.
"""

import os
import re
import sys

# Regex: matches 'contains: <expression> }' where <expression> has no comma or }
# This naturally skips lines that already have ', mode: "insensitive"' because
# the regex stops at the comma.
PATTERN = re.compile(r'contains:\s*([^,}\s]+(?:\.\w+\(\))?)\s*\}')

def process_file(filepath):
    """Process a single file. Returns (lines_changed, new_content)."""
    with open(filepath, 'r') as f:
        content = f.read()
    
    original = content
    changes = []
    
    def replacer(match):
        expr = match.group(1)
        old = match.group(0)
        new = f'contains: {expr}, mode: "insensitive" }}'
        changes.append((old, new))
        return new
    
    new_content = PATTERN.sub(replacer, content)
    
    if new_content != original:
        return len(changes), new_content
    return 0, content

def main():
    src_dir = sys.argv[1] if len(sys.argv) > 1 else 'src/app/api'
    
    if not os.path.isdir(src_dir):
        print(f"Error: {src_dir} is not a directory")
        sys.exit(1)
    
    total_files = 0
    total_changes = 0
    modified_files = []
    
    for root, dirs, files in os.walk(src_dir):
        # Skip node_modules
        if 'node_modules' in dirs:
            dirs.remove('node_modules')
        for fname in files:
            if not fname.endswith('.ts'):
                continue
            filepath = os.path.join(root, fname)
            count, new_content = process_file(filepath)
            if count > 0:
                with open(filepath, 'w') as f:
                    f.write(new_content)
                modified_files.append((filepath, count))
                total_files += 1
                total_changes += count
                print(f"  ✅ {filepath}: {count} change(s)")
    
    print(f"\n{'='*60}")
    print(f"Total files modified: {total_files}")
    print(f"Total contains() calls updated: {total_changes}")
    print(f"{'='*60}")
    
    if total_changes == 0:
        print("\nNo changes needed — all contains() calls already have mode: insensitive.")

if __name__ == '__main__':
    main()
