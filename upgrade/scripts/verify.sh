#!/bin/bash
# PAI Post-Upgrade Verification
# Checks that the v3 → v4 upgrade completed successfully.

set -euo pipefail

PASS=0
FAIL=0
WARN=0

pass() { echo "PASS"; PASS=$((PASS+1)); }
fail() { echo "FAIL"; FAIL=$((FAIL+1)); }
warn() { echo "WARN"; WARN=$((WARN+1)); }

echo "=== PAI v3 → v4 Upgrade Verification ==="
echo ""

# Structure
echo "--- Structure ---"

echo -n "PAI/ directory exists: "
test -d ~/.claude/PAI && pass || fail

echo -n "Algorithm installed: "
if test -f ~/.claude/PAI/Algorithm/LATEST; then
  echo "PASS ($(cat ~/.claude/PAI/Algorithm/LATEST))"
  PASS=$((PASS+1))
else
  fail
fi

echo -n "Skills hierarchical: "
test -d ~/.claude/skills/Thinking && test -d ~/.claude/skills/Security && pass || fail

echo -n "Custom skills preserved: "
if test -d ~/.claude/skills/Custom; then
  COUNT=$(ls ~/.claude/skills/Custom/ 2>/dev/null | wc -l)
  echo "PASS ($COUNT skills)"
  PASS=$((PASS+1))
else
  warn
fi

echo -n "No v3 flat skills remain: "
test -d ~/.claude/skills/CORE 2>/dev/null && fail || pass

# Config
echo ""
echo "--- Configuration ---"

echo -n "settings.json valid: "
jq empty ~/.claude/settings.json 2>/dev/null && pass || fail

echo -n "Principal name set: "
NAME=$(jq -r '.principal.name // empty' ~/.claude/settings.json 2>/dev/null)
if [ -n "$NAME" ]; then
  echo "PASS ($NAME)"
  PASS=$((PASS+1))
else
  fail
fi

echo -n "CLAUDE.md populated: "
LINES=$(wc -l < ~/.claude/CLAUDE.md 2>/dev/null || echo 0)
if [ "$LINES" -gt 10 ]; then
  echo "PASS ($LINES lines)"
  PASS=$((PASS+1))
else
  echo "FAIL ($LINES lines)"
  FAIL=$((FAIL+1))
fi

# Hooks
echo ""
echo "--- Hooks ---"

echo -n "BuildCLAUDE.ts present: "
test -f ~/.claude/hooks/handlers/BuildCLAUDE.ts && pass || fail

echo -n "v3-only hooks removed: "
if [ -f ~/.claude/hooks/handlers/AlgorithmEnrichment.ts ] || [ -f ~/.claude/hooks/handlers/RebuildSkill.ts ]; then
  fail
else
  pass
fi

# Data
echo ""
echo "--- Data ---"

echo -n "Memory intact: "
test -d ~/.claude/MEMORY/WORK && test -d ~/.claude/MEMORY/LEARNING && pass || fail

echo -n "User context in PAI/USER/: "
if test -d ~/.claude/PAI/USER; then
  COUNT=$(ls ~/.claude/PAI/USER/ 2>/dev/null | wc -l)
  echo "PASS ($COUNT files)"
  PASS=$((PASS+1))
else
  fail
fi

# Safety
echo ""
echo "--- Safety ---"

echo -n ".env preserved: "
test -f ~/.claude/.env && pass || warn

echo -n "Backup exists: "
BACKUP=$(cat ~/.claude/.upgrade-backup-path 2>/dev/null)
if [ -n "$BACKUP" ] && test -d "$BACKUP"; then
  echo "PASS ($BACKUP)"
  PASS=$((PASS+1))
else
  warn
fi

# Shell alias
echo ""
echo "--- Shell ---"

echo -n "Shell alias (no duplicates): "
SHELL_RC="$HOME/.$(basename "${SHELL:-bash}")rc"
ALIAS_COUNT=$(grep -c "^alias pai=" "$SHELL_RC" 2>/dev/null || echo 0)
if [ "$ALIAS_COUNT" -eq 1 ]; then
  echo "PASS (1 alias in $(basename "$SHELL_RC"))"
  PASS=$((PASS+1))
elif [ "$ALIAS_COUNT" -gt 1 ]; then
  echo "WARN ($ALIAS_COUNT duplicate aliases in $(basename "$SHELL_RC"))"
  WARN=$((WARN+1))
else
  echo "WARN (no alias found in $(basename "$SHELL_RC"))"
  WARN=$((WARN+1))
fi

# Companion detection
echo -n "Companion context preserved: "
if grep -q "PAI Companion setup\|Visual-first\|Visual-First" ~/.claude/PAI/USER/AISTEERINGRULES.md 2>/dev/null || \
   grep -q "PAI Companion setup\|Visual-first\|Visual-First" ~/.claude/PAI/USER/IDENTITY.md 2>/dev/null; then
  echo "PASS (companion additions found)"
  PASS=$((PASS+1))
elif grep -q "PAI Companion" ~/.claude/.upgrade-manifest.md 2>/dev/null && \
     grep -q "Detected: true" ~/.claude/.upgrade-manifest.md 2>/dev/null; then
  echo "FAIL (companion was detected but additions not found in PAI/USER/)"
  FAIL=$((FAIL+1))
else
  echo "SKIP (no companion installation)"
fi

# Results
echo ""
echo "=== Results: $PASS passed, $FAIL failed, $WARN warnings ==="

if [ "$FAIL" -eq 0 ]; then
  echo "Upgrade verification: SUCCESS"
  exit 0
else
  echo "Upgrade verification: ISSUES FOUND"
  exit 1
fi
