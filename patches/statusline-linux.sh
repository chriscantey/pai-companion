#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# PAI Statusline Linux Compatibility Fix
#
# The upstream PAI statusline uses macOS-specific syntax for `stat` and `sed`.
# This script adds cross-platform helper functions and replaces call sites.
#
# What it fixes:
#   - stat -f %m (macOS) → get_mtime() helper that works on both platforms
#   - Leaves sed calls alone (current statusline doesn't use sed -i)
#
# Safe to run multiple times (idempotent).
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

STATUSLINE="${HOME}/.claude/statusline-command.sh"

if [ ! -f "$STATUSLINE" ]; then
    echo "ERROR: statusline-command.sh not found at $STATUSLINE"
    exit 1
fi

# Check if already patched
if grep -q "cross-platform" "$STATUSLINE" 2>/dev/null; then
    echo "Statusline already patched for cross-platform compatibility."
    exit 0
fi

echo "Patching statusline for Linux compatibility..."

# Create backup
cp "$STATUSLINE" "${STATUSLINE}.bak"

# Helper functions to inject
HELPER_BLOCK='
# ─────────────────────────────────────────────────────────────────────────────
# CROSS-PLATFORM HELPERS (added by pai-companion)
# ─────────────────────────────────────────────────────────────────────────────

# cross-platform stat: get file modification time as epoch seconds
get_mtime() {
    if [[ "$OSTYPE" == darwin* ]]; then
        stat -f %m "$1" 2>/dev/null || echo 0
    else
        stat -c %Y "$1" 2>/dev/null || echo 0
    fi
}
'

# Step 1: Inject helper functions after 'set -o pipefail' (or after '# Source .env')
# Use awk to insert ONCE, context-aware (does NOT touch function bodies)
TMPFILE=$(mktemp)
awk -v helpers="$HELPER_BLOCK" '
/^set -o pipefail/ {
    print
    print helpers
    next
}
{ print }
' "$STATUSLINE" > "$TMPFILE"

# Step 2: Replace call sites using awk (NOT sed) to avoid touching the helper function.
# Pattern: $(stat -f %m "$VAR" 2>/dev/null || echo 0)  →  $(get_mtime "$VAR")
# Pattern: $(stat -c %Y "$VAR" 2>/dev/null || echo 0)  →  $(get_mtime "$VAR")
# Only replace lines that are NOT inside the helper function definition.
TMPFILE2=$(mktemp)
awk '
/^get_mtime\(\)/ { in_func=1 }
in_func && /^\}/ { in_func=0; print; next }
in_func { print; next }
{
    # Replace $(stat -f %m "EXPR" 2>/dev/null || echo 0) with $(get_mtime "EXPR")
    while (match($0, /\$\(stat -[fc] %[mY] ([^ ]+) 2>\/dev\/null \|\| echo 0\)/, arr)) {
        sub(/\$\(stat -[fc] %[mY] ([^ ]+) 2>\/dev\/null \|\| echo 0\)/, "$(get_mtime " arr[1] ")")
    }
    # Simpler fallback: replace bare stat -f %m calls (not inside function)
    gsub(/stat -f %m /, "get_mtime ")
    print
}
' "$TMPFILE" > "$TMPFILE2"

# If awk produced output, use it; otherwise fall back to helper-only version
if [ -s "$TMPFILE2" ]; then
    mv "$TMPFILE2" "$STATUSLINE"
    rm -f "$TMPFILE"
else
    mv "$TMPFILE" "$STATUSLINE"
    rm -f "$TMPFILE2"
fi

chmod +x "$STATUSLINE"

echo "Statusline patched successfully."
echo "  - Added cross-platform helper (get_mtime)"
echo "  - Replaced macOS stat call sites"
echo "  - Backup saved to ${STATUSLINE}.bak"
