#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# PAI Companion - Cron Job Setup
#
# Installs maintenance cron jobs:
#   1. Git auto-commit (daily at midnight) - snapshot ~/.claude and ~/work
#   2. Crontab export (after changes) - save to ~/data/crontab.txt
#
# Safe to run multiple times (checks for existing entries).
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

echo "Setting up maintenance cron jobs..."

# Ensure data directory exists
mkdir -p ~/data

# Build the cron entries
CRON_ENTRIES=""

# 1. Daily git auto-commit at midnight
CRON_ENTRY_GIT='0 0 * * * cd ~/.claude && git add -A && git commit -m "Auto: daily snapshot" --allow-empty 2>/dev/null; cd ~/work && git add -A && git commit -m "Auto: daily snapshot" --allow-empty 2>/dev/null'

# 2. Export crontab to ~/data after any cron run (daily at 12:05 AM)
CRON_ENTRY_EXPORT='5 0 * * * crontab -l > ~/data/crontab.txt 2>/dev/null'

# Get current crontab (suppress "no crontab" error)
CURRENT_CRON=$(crontab -l 2>/dev/null || echo "")

# Add each entry if not already present
add_if_missing() {
    local marker="$1"
    local comment="$2"
    local entry="$3"

    if echo "$CURRENT_CRON" | grep -qF "$marker"; then
        echo "  Already installed: $comment"
    else
        CURRENT_CRON="${CURRENT_CRON}
# ${comment}
${entry}"
        echo "  Added: $comment"
    fi
}

add_if_missing "daily snapshot" "PAI Companion: Daily git auto-commit" "$CRON_ENTRY_GIT"
add_if_missing "crontab.txt" "PAI Companion: Export crontab to ~/data" "$CRON_ENTRY_EXPORT"

# Install the updated crontab
echo "$CURRENT_CRON" | crontab -

# Export immediately
crontab -l > ~/data/crontab.txt 2>/dev/null

echo ""
echo "Cron jobs installed. Current crontab exported to ~/data/crontab.txt"
echo ""
echo "Installed jobs:"
echo "  - Daily at midnight: Git auto-commit (~/.claude and ~/work)"
echo "  - Daily at 12:05AM: Export crontab to ~/data/crontab.txt"
