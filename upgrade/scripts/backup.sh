#!/bin/bash
# PAI Pre-Upgrade Backup
# Creates a timestamped backup of ~/.claude/ and ensures git state is committed.

set -euo pipefail

CLAUDE_DIR="${HOME}/.claude"
BACKUP_DIR="${HOME}/pai-v3-backup-$(date +%Y%m%d-%H%M%S)"

echo "=== PAI Pre-Upgrade Backup ==="
echo ""

# Ensure git is initialized
cd "$CLAUDE_DIR"
if ! git rev-parse --git-dir >/dev/null 2>&1; then
  echo "Initializing git in $CLAUDE_DIR..."
  git init
  git config user.email "local@vm"
  git config user.name "PAI User"
fi

# Commit current state
echo "Committing current state..."
git add -A
git commit -m "Pre-upgrade snapshot: PAI v3 state before v4 upgrade" --allow-empty 2>/dev/null

# Create filesystem backup
echo "Creating backup at: $BACKUP_DIR"
cp -r "$CLAUDE_DIR" "$BACKUP_DIR"

# Record backup location
echo "$BACKUP_DIR" > "$CLAUDE_DIR/.upgrade-backup-path"

# Report
SIZE=$(du -sh "$BACKUP_DIR" | cut -f1)
echo ""
echo "Backup complete:"
echo "  Location: $BACKUP_DIR"
echo "  Size: $SIZE"
echo "  Git commit: $(git log --oneline -1)"
