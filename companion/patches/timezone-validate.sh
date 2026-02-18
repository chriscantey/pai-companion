#!/usr/bin/env bash
# Validate and fix the timezone in settings.json
#
# PAI's time.ts uses Intl.DateTimeFormat which requires IANA timezone IDs
# (e.g. "America/Los_Angeles"), not abbreviations (e.g. "PST").
# An invalid timezone silently crashes the voice pipeline and any
# time-dependent hooks.
#
# This script:
#   1. Reads the current timezone from settings.json
#   2. Validates it against the IANA database
#   3. If invalid, tries to detect the system timezone
#   4. If detection fails, falls back to UTC
#   5. Only modifies settings.json if a fix is needed
#
# Usage:
#   bash timezone-validate.sh
#
# Idempotent: safe to run multiple times. No changes if timezone is already valid.

set -euo pipefail

SETTINGS="$HOME/.claude/settings.json"

if [ ! -f "$SETTINGS" ]; then
  echo "settings.json not found at $SETTINGS"
  exit 1
fi

# Read current timezone
CURRENT_TZ=$(jq -r '.principal.timezone // empty' "$SETTINGS" 2>/dev/null || true)

if [ -z "$CURRENT_TZ" ]; then
  echo "No timezone set in settings.json — skipping validation."
  exit 0
fi

# Validate using bun/node Intl API (the same thing that crashes if invalid)
VALID=$(bun -e "try { Intl.DateTimeFormat('en', { timeZone: '$CURRENT_TZ' }); console.log('yes'); } catch { console.log('no'); }" 2>/dev/null || echo "no")

if [ "$VALID" = "yes" ]; then
  echo "Timezone OK: $CURRENT_TZ"
  exit 0
fi

echo "Invalid timezone in settings.json: \"$CURRENT_TZ\""
echo "JavaScript's Intl API requires IANA timezone IDs (e.g. America/Los_Angeles), not abbreviations."

# Common abbreviation mappings
declare -A TZ_MAP=(
  ["PST"]="America/Los_Angeles"
  ["PDT"]="America/Los_Angeles"
  ["MST"]="America/Denver"
  ["MDT"]="America/Denver"
  ["CST"]="America/Chicago"
  ["CDT"]="America/Chicago"
  ["EST"]="America/New_York"
  ["EDT"]="America/New_York"
  ["GMT"]="Europe/London"
  ["BST"]="Europe/London"
  ["CET"]="Europe/Berlin"
  ["CEST"]="Europe/Berlin"
  ["IST"]="Asia/Kolkata"
  ["JST"]="Asia/Tokyo"
  ["AEST"]="Australia/Sydney"
  ["AEDT"]="Australia/Sydney"
  ["NZST"]="Pacific/Auckland"
  ["NZDT"]="Pacific/Auckland"
)

UPPER_TZ=$(echo "$CURRENT_TZ" | tr '[:lower:]' '[:upper:]')
NEW_TZ=""

# Try abbreviation mapping
if [ -n "${TZ_MAP[$UPPER_TZ]+x}" ]; then
  NEW_TZ="${TZ_MAP[$UPPER_TZ]}"
  echo "Mapped abbreviation $CURRENT_TZ -> $NEW_TZ"
fi

# Try system timezone detection if mapping didn't work
if [ -z "$NEW_TZ" ]; then
  # timedatectl (systemd)
  if command -v timedatectl &>/dev/null; then
    SYS_TZ=$(timedatectl show -p Timezone --value 2>/dev/null || true)
    if [ -n "$SYS_TZ" ]; then
      # Validate the system timezone too
      SYS_VALID=$(bun -e "try { Intl.DateTimeFormat('en', { timeZone: '$SYS_TZ' }); console.log('yes'); } catch { console.log('no'); }" 2>/dev/null || echo "no")
      if [ "$SYS_VALID" = "yes" ]; then
        NEW_TZ="$SYS_TZ"
        echo "Detected system timezone: $NEW_TZ"
      fi
    fi
  fi
fi

# Try /etc/timezone
if [ -z "$NEW_TZ" ] && [ -f /etc/timezone ]; then
  SYS_TZ=$(cat /etc/timezone | tr -d '[:space:]')
  SYS_VALID=$(bun -e "try { Intl.DateTimeFormat('en', { timeZone: '$SYS_TZ' }); console.log('yes'); } catch { console.log('no'); }" 2>/dev/null || echo "no")
  if [ "$SYS_VALID" = "yes" ]; then
    NEW_TZ="$SYS_TZ"
    echo "Detected from /etc/timezone: $NEW_TZ"
  fi
fi

# Fall back to UTC
if [ -z "$NEW_TZ" ]; then
  NEW_TZ="UTC"
  echo "Could not determine timezone. Defaulting to UTC."
  echo "You can update it later in settings.json under principal.timezone"
  echo "Use an IANA timezone ID from: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones"
fi

# Apply the fix
TMP=$(mktemp)
jq --arg tz "$NEW_TZ" '.principal.timezone = $tz' "$SETTINGS" > "$TMP" && mv "$TMP" "$SETTINGS"
echo "Fixed: \"$CURRENT_TZ\" -> \"$NEW_TZ\" in settings.json"
