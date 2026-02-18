#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# PAI Statusline Linux Compatibility Patch
#
# Diagnoses and fixes Linux compatibility issues in the PAI statusline.
# Only applies fixes that are actually needed — safe to run on any version.
#
# Potential issues (each checked independently):
#   1. stat -f %m without cross-platform helper → adds get_mtime()
#   2. tr ' ' '─' garbles multibyte on GNU tr → adds repeat_dash() using sed
#   3. macOS Keychain-only OAuth token → adds Linux credentials.json fallback
#   4. .env sourced only from PAI_CONFIG_DIR → adds $PAI_DIR/.env fallback
#
# Future-proof: as upstream fixes these issues, this script automatically
# skips the fixes that are no longer needed. When all issues are resolved
# upstream, this script becomes a no-op.
#
# Safe to run multiple times (idempotent).
# Does NOT change macOS behavior — all fixes use $OSTYPE or fallback chains.
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

STATUSLINE="${HOME}/.claude/statusline-command.sh"

if [ ! -f "$STATUSLINE" ]; then
    echo "ERROR: statusline-command.sh not found at $STATUSLINE"
    exit 1
fi

echo "Diagnosing statusline for Linux compatibility..."
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# DIAGNOSE: Check each issue independently
# ─────────────────────────────────────────────────────────────────────────────

NEEDS_STAT=false
NEEDS_TR=false
NEEDS_OAUTH=false
NEEDS_ENV=false
FIX_COUNT=0

# 1. stat: needs fix if stat -f %m calls exist BUT no get_mtime helper exists
if grep -q 'stat -f %m' "$STATUSLINE" && ! grep -q 'get_mtime' "$STATUSLINE"; then
    NEEDS_STAT=true
    STAT_COUNT=$(grep -c 'stat -f %m' "$STATUSLINE" || true)
    echo "  [!] stat -f %m: $STAT_COUNT calls with no cross-platform helper"
    FIX_COUNT=$((FIX_COUNT + 1))
else
    echo "  [ok] stat: cross-platform handling present or not needed"
fi

# 2. tr: needs fix if tr ' ' '─' exists (GNU tr mangles multibyte)
TR_COUNT=$(grep -c "tr ' ' '─'" "$STATUSLINE" || true)
if [ "$TR_COUNT" -gt 0 ]; then
    NEEDS_TR=true
    echo "  [!] tr multibyte: $TR_COUNT calls will garble on GNU tr"
    FIX_COUNT=$((FIX_COUNT + 1))
else
    echo "  [ok] tr: no multibyte tr calls found"
fi

# 3. OAuth: needs fix if macOS Keychain is used without OSTYPE branching
if grep -q 'security find-generic-password' "$STATUSLINE" && ! grep -q 'credentials.json' "$STATUSLINE"; then
    NEEDS_OAUTH=true
    echo "  [!] OAuth: macOS Keychain only, no Linux fallback"
    FIX_COUNT=$((FIX_COUNT + 1))
else
    echo "  [ok] OAuth: Linux-compatible or not present"
fi

# 4. .env: needs fix if PAI_CONFIG_DIR is sourced but $PAI_DIR/.env is not
if grep -q 'PAI_CONFIG_DIR' "$STATUSLINE" && ! grep -q '"\$PAI_DIR/.env"' "$STATUSLINE"; then
    NEEDS_ENV=true
    echo "  [!] .env: only PAI_CONFIG_DIR sourced, no \$PAI_DIR fallback"
    FIX_COUNT=$((FIX_COUNT + 1))
else
    echo "  [ok] .env: sourcing path is fine"
fi

echo ""

if [ "$FIX_COUNT" -eq 0 ]; then
    echo "No fixes needed — statusline is already Linux-compatible."
    exit 0
fi

echo "Applying $FIX_COUNT fix(es)..."

# Create backup
cp "$STATUSLINE" "${STATUSLINE}.bak"
echo "  Backup: ${STATUSLINE}.bak"

# ─────────────────────────────────────────────────────────────────────────────
# FIX 1: Add get_mtime() helper and replace stat -f %m calls
# Only if stat -f %m exists without an existing get_mtime function
# ─────────────────────────────────────────────────────────────────────────────

if [ "$NEEDS_STAT" = true ]; then
    TMPFILE=$(mktemp)

    # Determine the .env anchor line to inject after
    if grep -q 'PAI_CONFIG_DIR' "$STATUSLINE"; then
        ANCHOR='PAI_CONFIG_DIR'
    else
        ANCHOR='Source .env for API keys'
    fi

    # Inject get_mtime helper after the .env sourcing block
    awk -v anchor="$ANCHOR" '
    $0 ~ anchor && !injected {
        print
        getline; print  # print the source line too
        print ""
        print "# Cross-platform file mtime (seconds since epoch)"
        print "# Linux stat -c %Y first, macOS stat -f %m fallback"
        print "get_mtime() {"
        print "    stat -c %Y \"$1\" 2>/dev/null || stat -f %m \"$1\" 2>/dev/null || echo 0"
        print "}"
        injected = 1
        next
    }
    { print }
    ' "$STATUSLINE" > "$TMPFILE"

    if grep -q 'get_mtime' "$TMPFILE"; then
        mv "$TMPFILE" "$STATUSLINE"
    else
        echo "  WARNING: Could not inject get_mtime helper"
        rm -f "$TMPFILE"
    fi

    # Replace stat -f %m call sites (skip the helper function body)
    TMPFILE=$(mktemp)
    perl -pe '
        if (/^get_mtime\(\)/ .. /^\}/) { next if !/^\}/; }
        s/stat -f %m ("[^"]*") 2>\/dev\/null \|\| echo 0/get_mtime $1/g;
    ' "$STATUSLINE" > "$TMPFILE"
    mv "$TMPFILE" "$STATUSLINE"

    echo "  [1/$FIX_COUNT] Added get_mtime() + replaced $STAT_COUNT stat calls"
fi

# ─────────────────────────────────────────────────────────────────────────────
# FIX 2: Replace tr multibyte dash rendering with sed-based helper
# GNU tr treats multibyte chars byte-by-byte, producing garbled output
# ─────────────────────────────────────────────────────────────────────────────

if [ "$NEEDS_TR" = true ]; then
    # Inject repeat_dash helper if not already present
    if ! grep -q 'repeat_dash' "$STATUSLINE"; then
        TMPFILE=$(mktemp)
        # Find a good injection point: after get_mtime if it exists, else after .env
        if grep -q 'get_mtime' "$STATUSLINE"; then
            awk '
            /^get_mtime\(\)/ { in_func=1 }
            in_func && /^\}/ {
                in_func=0
                print
                print ""
                print "# Repeat a (possibly multibyte) character N times"
                print "# GNU tr mangles multibyte chars; sed handles them correctly"
                print "repeat_dash() {"
                print "    local count=\"$1\""
                print "    [ \"$count\" -lt 1 ] 2>/dev/null && count=1"
                print "    printf '"'"'%*s'"'"' \"$count\" '"'"''"'"' | sed '"'"'s/ /─/g'"'"'"
                print "}"
                next
            }
            in_func { print; next }
            { print }
            ' "$STATUSLINE" > "$TMPFILE"
        else
            # No get_mtime — inject after .env sourcing
            awk '
            /Source \.env/ && !injected {
                print; getline; print
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
        fi
        mv "$TMPFILE" "$STATUSLINE"
    fi

    # Replace tr calls with repeat_dash
    TMPFILE=$(mktemp)
    perl -pe "s/printf '%\\*s' \"\\\$local_fill\" '' \\| tr ' ' '─'/repeat_dash \"\\\$local_fill\"/g" "$STATUSLINE" > "$TMPFILE"
    mv "$TMPFILE" "$STATUSLINE"

    echo "  [fix] Replaced $TR_COUNT tr multibyte calls with repeat_dash"
fi

# ─────────────────────────────────────────────────────────────────────────────
# FIX 3: Add Linux OAuth token fallback
# macOS reads from Keychain; Linux reads from ~/.claude/.credentials.json
# ─────────────────────────────────────────────────────────────────────────────

if [ "$NEEDS_OAUTH" = true ]; then
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
    echo "  [fix] Added Linux OAuth via ~/.claude/.credentials.json"
fi

# ─────────────────────────────────────────────────────────────────────────────
# FIX 4: Add $PAI_DIR/.env sourcing fallback
# Some installs use PAI_CONFIG_DIR, others use PAI_DIR directly
# ─────────────────────────────────────────────────────────────────────────────

if [ "$NEEDS_ENV" = true ]; then
    TMPFILE=$(mktemp)
    awk '
    /PAI_CONFIG_DIR.*\.env.*source/ && !env_injected {
        print
        print "[ -f \"$PAI_DIR/.env\" ] && source \"$PAI_DIR/.env\""
        env_injected = 1
        next
    }
    { print }
    ' "$STATUSLINE" > "$TMPFILE"
    mv "$TMPFILE" "$STATUSLINE"
    echo "  [fix] Added \$PAI_DIR/.env fallback"
fi

# ─────────────────────────────────────────────────────────────────────────────
# Done
# ─────────────────────────────────────────────────────────────────────────────

chmod +x "$STATUSLINE"

echo ""
echo "Done. $FIX_COUNT issue(s) fixed."
echo "All fixes are cross-platform safe (macOS behavior unchanged)."
