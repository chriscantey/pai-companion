#!/bin/bash
# PAI Version Detection
# Detects the currently installed PAI version based on filesystem heuristics.

set -euo pipefail

CLAUDE_DIR="${HOME}/.claude"

if [ ! -d "$CLAUDE_DIR" ]; then
  echo "none"
  exit 0
fi

# v4.0+ has the PAI/ directory with Algorithm/LATEST
if [ -d "$CLAUDE_DIR/PAI" ] && [ -f "$CLAUDE_DIR/PAI/Algorithm/LATEST" ]; then
  VERSION=$(jq -r '.paiVersion // "4.0"' "$CLAUDE_DIR/settings.json" 2>/dev/null || echo "4.0")
  echo "v${VERSION}"
  exit 0
fi

# v3.0 has flat skills structure with CORE skill and no PAI/ directory
if [ -d "$CLAUDE_DIR/skills/CORE" ] || [ -d "$CLAUDE_DIR/skills/BeCreative" ]; then
  if [ ! -d "$CLAUDE_DIR/PAI" ]; then
    echo "v3.0"
    exit 0
  fi
fi

# v2.5 or earlier: has skills/ but no CORE (v3 indicator) and no PAI/ (v4 indicator)
if [ -d "$CLAUDE_DIR/skills" ]; then
  echo "v2.x"
  exit 0
fi

echo "unknown"
