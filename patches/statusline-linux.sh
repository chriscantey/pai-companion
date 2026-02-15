#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# PAI Statusline Linux Compatibility Patch (v3.0)
#
# The upstream PAI statusline uses macOS-specific `stat -f %m` for file
# modification times. On Linux, `stat -f` returns filesystem info instead
# of file mtime, breaking all cache age calculations. Linux needs `stat -c %Y`.
#
# This script adds a cross-platform get_mtime() helper and replaces all
# call sites. Additional fixes are applied if the statusline has extended
# sections (tr multibyte rendering, OAuth Keychain, .env sourcing).
#
# Safe to run multiple times (idempotent).
# Does NOT change macOS behavior — uses $OSTYPE detection.
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

STATUSLINE="${HOME}/.claude/statusline-command.sh"

if [ ! -f "$STATUSLINE" ]; then
    echo "ERROR: statusline-command.sh not found at $STATUSLINE"
    exit 1
fi

# Check if already patched
if grep -q "CROSS-PLATFORM HELPERS" "$STATUSLINE" 2>/dev/null; then
    echo "Statusline already patched for cross-platform compatibility."
    exit 0
fi

echo "Patching statusline for Linux compatibility..."
echo ""

# Create backup
cp "$STATUSLINE" "${STATUSLINE}.bak"
echo "  Backup saved to ${STATUSLINE}.bak"

# Count what needs fixing
STAT_COUNT=$(grep -c 'stat -f %m' "$STATUSLINE" || true)
TR_COUNT=$(grep -c "tr ' ' '─'" "$STATUSLINE" || true)
KEYCHAIN_COUNT=$(grep -c 'Extract OAuth token from macOS Keychain' "$STATUSLINE" || true)
HAS_PAI_CONFIG_DIR=$(grep -c 'PAI_CONFIG_DIR' "$STATUSLINE" || true)

echo "  Detected: ${STAT_COUNT} stat calls, ${TR_COUNT} tr calls, ${KEYCHAIN_COUNT} keychain blocks"

# ─────────────────────────────────────────────────────────────────────────────
# FIX 1: Inject cross-platform helpers after .env sourcing
# ─────────────────────────────────────────────────────────────────────────────

# Build the helpers block — include repeat_dash only if tr calls exist
TMPFILE=$(mktemp)

if [ "$TR_COUNT" -gt 0 ]; then
    # Extended statusline: needs both helpers
    awk '
    /Source \.env for API keys/ && !injected {
        print
        getline  # print the existing source line too
        print
        # Add .env fallback if using PAI_CONFIG_DIR pattern
        if ($0 ~ /PAI_CONFIG_DIR/) {
            print "[ -f \"$PAI_DIR/.env\" ] && source \"$PAI_DIR/.env\""
            print ""
        }
        print "# ─────────────────────────────────────────────────────────────────────────────"
        print "# CROSS-PLATFORM HELPERS (added by pai-companion)"
        print "# ─────────────────────────────────────────────────────────────────────────────"
        print ""
        print "# File modification time as epoch seconds (macOS vs Linux stat syntax)"
        print "get_mtime() {"
        print "    if [[ \"$OSTYPE\" == darwin* ]]; then"
        print "        stat -f %m \"$1\" 2>/dev/null || echo 0"
        print "    else"
        print "        stat -c %Y \"$1\" 2>/dev/null || echo 0"
        print "    fi"
        print "}"
        print ""
        print "# Repeat a (possibly multibyte) character N times"
        print "# GNU tr mangles multibyte chars; sed handles them correctly"
        print "repeat_dash() {"
        print "    local count=\"$1\""
        print "    [ \"$count\" -lt 1 ] 2>/dev/null && count=1"
        print "    printf '"'"'%*s'"'"' \"$count\" '"'"''"'"' | sed '"'"'s/ /─/g'"'"'"
        print "}"
        injected = 1
        next
    }
    { print }
    ' "$STATUSLINE" > "$TMPFILE"
else
    # Standard upstream statusline: only needs get_mtime
    awk '
    /Source \.env for API keys/ && !injected {
        print
        getline  # print the existing source line too
        print
        print ""
        print "# ─────────────────────────────────────────────────────────────────────────────"
        print "# CROSS-PLATFORM HELPERS (added by pai-companion)"
        print "# ─────────────────────────────────────────────────────────────────────────────"
        print ""
        print "# File modification time as epoch seconds (macOS vs Linux stat syntax)"
        print "get_mtime() {"
        print "    if [[ \"$OSTYPE\" == darwin* ]]; then"
        print "        stat -f %m \"$1\" 2>/dev/null || echo 0"
        print "    else"
        print "        stat -c %Y \"$1\" 2>/dev/null || echo 0"
        print "    fi"
        print "}"
        injected = 1
        next
    }
    { print }
    ' "$STATUSLINE" > "$TMPFILE"
fi

# Verify injection worked
if ! grep -q "CROSS-PLATFORM HELPERS" "$TMPFILE"; then
    echo "ERROR: Failed to inject helper functions. Could not find '.env for API keys' anchor."
    rm -f "$TMPFILE"
    mv "${STATUSLINE}.bak" "$STATUSLINE"
    exit 1
fi

mv "$TMPFILE" "$STATUSLINE"
echo "  [1] Added cross-platform helpers"

# ─────────────────────────────────────────────────────────────────────────────
# FIX 2: Replace all stat -f %m calls with get_mtime
# Skip lines inside the helper function definition
# ─────────────────────────────────────────────────────────────────────────────

if [ "$STAT_COUNT" -gt 0 ]; then
    TMPFILE=$(mktemp)
    # Replace stat -f %m call sites with get_mtime, but SKIP lines inside the
    # helper function (which also contains stat -f %m as its implementation).
    # Use perl for reliable regex backreferences across all platforms.
    perl -pe '
        # Skip lines inside the helper function
        if (/^get_mtime\(\)/ .. /^\}/) { next if !/^\}/; }
        # Replace: stat -f %m "VAR" 2>/dev/null || echo 0 → get_mtime "VAR"
        s/stat -f %m ("[^"]*") 2>\/dev\/null \|\| echo 0/get_mtime $1/g;
    ' "$STATUSLINE" > "$TMPFILE"

    REMAINING=$(grep -c 'stat -f %m' "$TMPFILE" || true)
    # Should be 1 (inside the helper function definition)
    mv "$TMPFILE" "$STATUSLINE"
    echo "  [2] Replaced stat -f %m call sites with get_mtime (${REMAINING} kept in helper)"
fi

# ─────────────────────────────────────────────────────────────────────────────
# FIX 3: Replace tr multibyte dash rendering (if present)
# ─────────────────────────────────────────────────────────────────────────────

if [ "$TR_COUNT" -gt 0 ]; then
    TMPFILE=$(mktemp)
    perl -pe "s/printf '%\\*s' \"\\\$local_fill\" '' \\| tr ' ' '─'/repeat_dash \"\\\$local_fill\"/g" "$STATUSLINE" > "$TMPFILE"
    mv "$TMPFILE" "$STATUSLINE"
    echo "  [3] Replaced ${TR_COUNT} tr multibyte calls with repeat_dash"
else
    echo "  [3] No tr multibyte calls found (skipped)"
fi

# ─────────────────────────────────────────────────────────────────────────────
# FIX 4: Linux OAuth token (if macOS Keychain block present)
# ─────────────────────────────────────────────────────────────────────────────

if [ "$KEYCHAIN_COUNT" -gt 0 ]; then
    TMPFILE=$(mktemp)
    awk '
    /# Extract OAuth token from macOS Keychain/ {
        print "        # Extract OAuth token: macOS Keychain or Linux credentials file"
        print "        if [[ \"$OSTYPE\" == darwin* ]]; then"
        getline  # skip old security line
        getline  # skip old python3 line
        print "            keychain_data=$(security find-generic-password -s \"Claude Code-credentials\" -w 2>/dev/null)"
        print "            token=$(echo \"$keychain_data\" | python3 -c \"import sys,json; d=json.load(sys.stdin); print(d.get(\\x27claudeAiOauth\\x27,{}).get(\\x27accessToken\\x27,\\x27\\x27))\" 2>/dev/null)"
        print "        else"
        print "            cred_file=\"$HOME/.claude/.credentials.json\""
        print "            [ -f \"$cred_file\" ] && token=$(jq -r '"'"'.claudeAiOauth.accessToken // empty'"'"' \"$cred_file\" 2>/dev/null)"
        print "        fi"
        next
    }
    { print }
    ' "$STATUSLINE" > "$TMPFILE"
    mv "$TMPFILE" "$STATUSLINE"
    echo "  [4] Added Linux OAuth via ~/.claude/.credentials.json"
else
    echo "  [4] No macOS Keychain block found (skipped)"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Finalize
# ─────────────────────────────────────────────────────────────────────────────

chmod +x "$STATUSLINE"

echo ""
echo "Statusline patched successfully."
echo "All fixes use OSTYPE detection — macOS behavior unchanged."
