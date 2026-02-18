#!/usr/bin/env bash
# Extend voice notification timeout for local Kokoro TTS
#
# PAI's default VoiceNotification.ts has a 3-second timeout designed for
# ElevenLabs cloud API (which responds in <1s). Local Kokoro TTS needs
# 3-5 seconds for synthesis, so the 3s timeout causes aborted requests
# and silent failures.
#
# This script changes the timeout to 15 seconds, which is safe for both
# cloud and local TTS providers.
#
# Usage:
#   bash voice-timeout.sh
#
# Idempotent: safe to run multiple times. No changes if already patched.

set -euo pipefail

VOICE_HANDLER="$HOME/.claude/hooks/handlers/VoiceNotification.ts"

if [ ! -f "$VOICE_HANDLER" ]; then
  echo "VoiceNotification.ts not found at $VOICE_HANDLER"
  echo "This is expected if PAI hooks are not yet installed."
  exit 1
fi

# Check current timeout value
CURRENT=$(grep -oP 'setTimeout\(\(\) => controller\.abort\(\), \K[0-9]+' "$VOICE_HANDLER" 2>/dev/null || true)

if [ -z "$CURRENT" ]; then
  echo "Could not find timeout pattern in VoiceNotification.ts"
  echo "The file may have a different structure than expected."
  exit 1
fi

if [ "$CURRENT" -ge 15000 ]; then
  echo "Timeout already set to ${CURRENT}ms — no change needed."
  exit 0
fi

echo "Current timeout: ${CURRENT}ms (too short for local TTS)"
echo "Updating to 15000ms..."

# Replace the timeout value and update the comment
sed -i "s/setTimeout(() => controller.abort(), ${CURRENT});.*/setTimeout(() => controller.abort(), 15000); \/\/ 15s timeout - local Kokoro TTS needs time for synthesis/" "$VOICE_HANDLER"

# Verify the change
NEW=$(grep -oP 'setTimeout\(\(\) => controller\.abort\(\), \K[0-9]+' "$VOICE_HANDLER" 2>/dev/null || true)

if [ "$NEW" = "15000" ]; then
  echo "Fixed: ${CURRENT}ms -> 15000ms in VoiceNotification.ts"
else
  echo "ERROR: Patch may not have applied correctly. Please check $VOICE_HANDLER manually."
  exit 1
fi
