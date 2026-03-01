# PAI Upgrade: v3 to v4

> **For AI Assistants.** If you were directed here by your user to upgrade their PAI installation, follow the phases below. Each phase is independently verifiable. If interrupted, you can resume from any phase.

**Prerequisites (verify before starting):** See [PREREQUISITES.md](PREREQUISITES.md)
- PAI v3 currently installed in `~/.claude/`
- Claude Code installed and authenticated
- Bun runtime installed
- Git installed
- At least 500MB free disk space
- No other Claude Code sessions running

**Reference material:** See [reference/v3-to-v4-diff.md](reference/v3-to-v4-diff.md) for the complete structural diff between v3 and v4.

**Upstream release files:** The upgrade copies files from the PAI v4 release. These should be available at either:
- Local: `~/upstream/pai/Releases/v4.*/.claude/` (if the upstream repo is cloned; uses the latest v4.x release)
- Remote: The PAI GitHub releases page

If the local path doesn't exist, clone the upstream repo first:
```bash
git clone https://github.com/danielmiessler/PAI.git ~/upstream/pai
```

Throughout this document, `V4_SOURCE` and `V3_SOURCE` refer to the release directories:
```bash
V3_SOURCE=~/upstream/pai/Releases/v3.0/.claude
V4_SOURCE=$(ls -d ~/upstream/pai/Releases/v4.*/.claude 2>/dev/null | sort -V | tail -1)
```

---

### Phase 0: Version Detection and Pre-flight

Detect the current PAI version and validate that this upgrade path applies.

**Steps:**

1. Detect the current version:
   ```bash
   # v4+ has the PAI/ directory
   if [ -d ~/.claude/PAI ]; then
     echo "DETECTED: v4+ (PAI/ directory exists)"
     echo "This upgrade is for v3 → v4. You may already be on v4."
     cat ~/.claude/PAI/Algorithm/LATEST 2>/dev/null
   # v3 has flat skills and no PAI/ directory
   elif [ -d ~/.claude/skills ] && [ ! -d ~/.claude/PAI ]; then
     # Check for v3 indicators: flat skill structure, specific hooks
     if [ -d ~/.claude/skills/CORE ] || [ -d ~/.claude/skills/BeCreative ]; then
       echo "DETECTED: v3 (flat skills structure, no PAI/ directory)"
     else
       echo "DETECTED: Unknown version (has skills/ but not v3 structure)"
     fi
   else
     echo "DETECTED: No PAI installation found"
     echo "This upgrade requires an existing v3 installation."
     echo "For a fresh install, use the PAI installer instead."
   fi
   ```

2. Verify the v4 source is available:
   ```bash
   V4_SOURCE=$(ls -d ~/upstream/pai/Releases/v4.*/.claude 2>/dev/null | sort -V | tail -1)
   test -d "$V4_SOURCE/skills" && echo "v4 source: READY" || echo "v4 source: NOT FOUND"
   ```

3. Check disk space:
   ```bash
   df -h ~ | tail -1 | awk '{print "Available: " $4}'
   ```

4. Inventory the current installation:
   ```bash
   echo "=== Current Installation ==="
   echo "Skills: $(ls ~/.claude/skills/ 2>/dev/null | wc -l) directories"
   echo "Hooks: $(ls ~/.claude/hooks/handlers/ 2>/dev/null | wc -l) handler files"
   echo "Memory: $(du -sh ~/.claude/MEMORY/ 2>/dev/null | cut -f1)"
   echo "Git tracked: $(git -C ~/.claude rev-parse --git-dir 2>/dev/null && echo 'yes' || echo 'no')"
   ```

**Verification:** Version is detected as v3. The v4 source directory exists. Disk space is sufficient.

**STOP if:** Version is detected as v4+ (already upgraded) or no PAI installation found.

---

### Phase 1: Full Backup

Create a complete backup before making any changes. This is your safety net.

**Steps:**

1. If `~/.claude/` is not git-tracked, initialize it:
   ```bash
   cd ~/.claude
   if ! git rev-parse --git-dir >/dev/null 2>&1; then
     git init
     git config user.email "local@vm"
     git config user.name "PAI User"
   fi
   ```

2. Commit current state:
   ```bash
   cd ~/.claude && git add -A && git commit -m "Pre-upgrade snapshot: PAI v3 state before v4 upgrade" --allow-empty
   ```

3. Create a timestamped backup:
   ```bash
   BACKUP_DIR=~/pai-v3-backup-$(date +%Y%m%d-%H%M%S)
   cp -r ~/.claude "$BACKUP_DIR"
   echo "Backup created at: $BACKUP_DIR"
   echo "Size: $(du -sh "$BACKUP_DIR" | cut -f1)"
   ```

4. Record the backup location:
   ```bash
   echo "$BACKUP_DIR" > ~/.claude/.upgrade-backup-path
   ```

**Verification:**
- `git -C ~/.claude log --oneline -1` shows the pre-upgrade commit
- The backup directory exists and is non-empty: `test -d "$BACKUP_DIR/skills" && echo "PASS" || echo "FAIL"`
- Backup path is recorded: `cat ~/.claude/.upgrade-backup-path`

---

### Phase 2: Identify and Protect User State

Scan the installation to find user customizations that must be preserved.

**Steps:**

1. Identify custom skills (skills not in v3 upstream):
   ```bash
   # Dynamic detection: compare against the v3.0 release directory
   V3_SOURCE=~/upstream/pai/Releases/v3.0/.claude
   if [ -d "$V3_SOURCE/skills" ]; then
     V3_UPSTREAM_SKILLS=$(ls "$V3_SOURCE/skills/" 2>/dev/null | tr '\n' ' ')
     echo "Detection method: dynamic (from upstream v3 release)"
   else
     # Fallback: hardcoded v3 upstream list (38 skills)
     V3_UPSTREAM_SKILLS="Agents AnnualReports Aphorisms Apify Art BeCreative BrightData Browser Cloudflare CORE Council CreateCLI CreateSkill Documents Evals ExtractWisdom Fabric FirstPrinciples IterativeDepth OSINT PAI PAIUpgrade Parser PrivateInvestigator Prompting PromptInjection Recon RedTeam Remotion Research Sales Science SECUpdates Telos USMetrics WebAssessment WorldThreatModelHarness WriteStory"
     echo "Detection method: fallback (hardcoded v3 list)"
   fi

   echo "=== Custom Skills (user-created, will be preserved) ==="
   CUSTOM_COUNT=0
   for skill in ~/.claude/skills/*/; do
     skill_name=$(basename "$skill")
     [ "$skill_name" = "Custom" ] && continue
     if ! echo "$V3_UPSTREAM_SKILLS" | grep -qw "$skill_name"; then
       echo "  CUSTOM: $skill_name"
       CUSTOM_COUNT=$((CUSTOM_COUNT+1))
     fi
   done
   echo "Found $CUSTOM_COUNT custom skill(s)"
   ```

2. Identify user context files:
   ```bash
   echo "=== User Context Files ==="
   # v3 user files live in skills/PAI/USER/ or similar
   find ~/.claude/skills/PAI/USER/ -type f 2>/dev/null | while read f; do
     echo "  USER: $f"
   done

   # Also check for user files at other common locations
   for f in ~/.claude/CLAUDE.md ~/.claude/.env ~/.claude/settings.json; do
     test -f "$f" && echo "  CONFIG: $f"
   done
   ```

3. Detect PAI Companion additions:
   ```bash
   echo "=== PAI Companion Detection ==="
   COMPANION_DETECTED=false

   # Check for companion marker in identity or steering rules
   if grep -q "PAI Companion setup" ~/.claude/skills/PAI/USER/IDENTITY.md 2>/dev/null || \
      grep -q "PAI Companion setup" ~/.claude/PAI/USER/IDENTITY.md 2>/dev/null; then
     echo "  FOUND: Companion identity additions (portal, exchange, clipboard config)"
     COMPANION_DETECTED=true
   fi

   if grep -q "Visual-first\|Visual-First" ~/.claude/skills/PAI/USER/AISTEERINGRULES.md 2>/dev/null || \
      grep -q "Visual-first\|Visual-First" ~/.claude/PAI/USER/AISTEERINGRULES.md 2>/dev/null; then
     echo "  FOUND: Companion steering rules (visual-first, portal-first, dark theme)"
     COMPANION_DETECTED=true
   fi

   if [ -f ~/.claude/PAI/USER/DESIGN.md ] || [ -f ~/.claude/skills/PAI/USER/DESIGN.md ]; then
     echo "  FOUND: Companion design system (DESIGN.md)"
     COMPANION_DETECTED=true
   fi

   # Check for companion Docker services
   if docker ps 2>/dev/null | grep -q "portal\|pai-portal"; then
     echo "  FOUND: Companion portal server (Docker)"
     COMPANION_DETECTED=true
   fi

   if [ "$COMPANION_DETECTED" = true ]; then
     echo "  STATUS: PAI Companion detected. Additions will be preserved during migration."
   else
     echo "  STATUS: No PAI Companion detected. Standard upgrade."
   fi
   ```

4. Identify custom hooks (hooks not in the v3 upstream list):
   ```bash
   V3_UPSTREAM_HOOKS="AlgorithmEnrichment.ts DocCrossRefIntegrity.ts RebuildSkill.ts SystemIntegrity.ts TabState.ts UpdateCounts.ts VoiceNotification.ts"

   echo "=== Custom Hooks ==="
   for hook in ~/.claude/hooks/handlers/*; do
     hook_name=$(basename "$hook")
     if ! echo "$V3_UPSTREAM_HOOKS" | grep -qw "$hook_name"; then
       echo "  CUSTOM HOOK: $hook_name"
     fi
   done
   ```

5. Save the inventory:
   ```bash
   # Create a manifest of everything custom
   {
     echo "# PAI Upgrade Manifest - $(date -Iseconds)"
     echo "# Custom items to preserve during v3 → v4 upgrade"
     echo ""
     echo "## Custom Skills"
     for skill in ~/.claude/skills/*/; do
       skill_name=$(basename "$skill")
       [ "$skill_name" = "Custom" ] && continue
       if ! echo "$V3_UPSTREAM_SKILLS" | grep -qw "$skill_name"; then
         echo "- $skill_name"
       fi
     done
     echo ""
     echo "## User Context Files"
     find ~/.claude/skills/PAI/USER/ -type f 2>/dev/null | sed 's/^/- /'
     echo ""
     echo "## PAI Companion"
     echo "- Detected: $COMPANION_DETECTED"
     echo ""
     echo "## Custom Hooks"
     for hook in ~/.claude/hooks/handlers/*; do
       hook_name=$(basename "$hook")
       if ! echo "$V3_UPSTREAM_HOOKS" | grep -qw "$hook_name"; then
         echo "- $hook_name"
       fi
     done
   } > ~/.claude/.upgrade-manifest.md
   ```

6. **Report the inventory to the user.** Show what custom items were found. Ask the user to confirm before proceeding. If there are unexpected items, discuss before continuing.

**Verification:**
- Manifest file exists: `test -f ~/.claude/.upgrade-manifest.md && echo "PASS" || echo "FAIL"`
- Review the manifest: `cat ~/.claude/.upgrade-manifest.md`
- User has confirmed the inventory is correct

---

### Phase 3: Migrate Custom Skills

Move user-created skills to the v4 `skills/Custom/` directory before replacing upstream skills.

**Steps:**

1. Create the Custom skills directory:
   ```bash
   mkdir -p ~/.claude/skills/Custom
   ```

2. Move each custom skill:
   ```bash
   # Reuse the detection method from Phase 2
   V3_SOURCE=~/upstream/pai/Releases/v3.0/.claude
   if [ -d "$V3_SOURCE/skills" ]; then
     V3_UPSTREAM_SKILLS=$(ls "$V3_SOURCE/skills/" 2>/dev/null | tr '\n' ' ')
   else
     V3_UPSTREAM_SKILLS="Agents AnnualReports Aphorisms Apify Art BeCreative BrightData Browser Cloudflare CORE Council CreateCLI CreateSkill Documents Evals ExtractWisdom Fabric FirstPrinciples IterativeDepth OSINT PAI PAIUpgrade Parser PrivateInvestigator Prompting PromptInjection Recon RedTeam Remotion Research Sales Science SECUpdates Telos USMetrics WebAssessment WorldThreatModelHarness WriteStory"
   fi

   for skill in ~/.claude/skills/*/; do
     skill_name=$(basename "$skill")
     [ "$skill_name" = "Custom" ] && continue
     if ! echo "$V3_UPSTREAM_SKILLS" | grep -qw "$skill_name"; then
       echo "Moving custom skill: $skill_name → skills/Custom/$skill_name"
       mv "$skill" ~/.claude/skills/Custom/
     fi
   done
   ```

3. Verify custom skills have valid SKILL.md files:
   ```bash
   echo "=== Custom Skill Validation ==="
   for skill in ~/.claude/skills/Custom/*/; do
     skill_name=$(basename "$skill")
     if [ -f "$skill/SKILL.md" ]; then
       echo "  $skill_name: SKILL.md present"
     else
       echo "  $skill_name: WARNING - no SKILL.md found"
     fi
   done
   ```

**Verification:**
- `skills/Custom/` directory exists: `test -d ~/.claude/skills/Custom && echo "PASS"`
- Custom skills are in `skills/Custom/` (or directory is empty if user had no custom skills, which is fine): `ls ~/.claude/skills/Custom/ 2>/dev/null || echo "(empty - no custom skills)"`
- No custom skills remain in the flat `skills/` root (only upstream v3 skills remain)
- Each custom skill (if any) has a SKILL.md

---

### Phase 4: Replace Upstream Skills

Remove v3 upstream skills and install v4 hierarchical skill structure.

**Steps:**

1. Back up user context from skills/PAI/USER/ before removing v3 skills:
   ```bash
   # v3 stored user context in skills/PAI/USER/
   # This must happen BEFORE we remove v3 skills below
   if [ -d ~/.claude/skills/PAI/USER ]; then
     mkdir -p ~/.claude/.upgrade-user-context-backup
     cp -r ~/.claude/skills/PAI/USER/* ~/.claude/.upgrade-user-context-backup/
     echo "Backed up v3 user context from skills/PAI/USER/"
     ls ~/.claude/.upgrade-user-context-backup/
   fi
   ```

2. Remove v3 upstream skills (Custom/ is preserved):
   ```bash
   # Remove everything in skills/ EXCEPT Custom/
   # At this point, Phase 3 already moved all custom skills to Custom/
   # So everything remaining at the root level is v3 upstream
   for skill in ~/.claude/skills/*/; do
     skill_name=$(basename "$skill")
     [ "$skill_name" = "Custom" ] && continue
     rm -rf "$skill"
     echo "Removed v3 skill: $skill_name"
   done
   ```

3. Copy v4 skill categories from the release:
   ```bash
   V4_SOURCE=$(ls -d ~/upstream/pai/Releases/v4.*/.claude 2>/dev/null | sort -V | tail -1)

   for category in "$V4_SOURCE"/skills/*/; do
     cat_name=$(basename "$category")
     [ "$cat_name" = "Custom" ] && continue
     echo "Installing v4 skill category: $cat_name"
     cp -r "$category" ~/.claude/skills/
   done
   ```

4. Verify the new structure:
   ```bash
   echo "=== v4 Skill Categories ==="
   for cat in ~/.claude/skills/*/; do
     cat_name=$(basename "$cat")
     skill_count=$(find "$cat" -name "SKILL.md" | wc -l)
     echo "  $cat_name: $skill_count skill(s)"
   done
   ```

**Verification:**
- No v3 flat skills remain (except Custom/): `ls ~/.claude/skills/ | sort`
- v4 categories are present: should see Agents, ContentAnalysis, Investigation, Media, Research, Scraping, Security, Telos, Thinking, USMetrics, Utilities, Custom
- Custom skills are still intact: `ls ~/.claude/skills/Custom/`

---

### Phase 5: Hook Migration

Update all hook files: both the root `.hook.ts` files (called by settings.json) and the `handlers/` directory.

**Steps:**

1. Back up the entire hooks directory:
   ```bash
   cp -r ~/.claude/hooks ~/.claude/hooks.v3-backup
   echo "Backed up hooks directory"
   ```

2. Install all v4 root hook files (`.hook.ts`):
   ```bash
   V4_SOURCE=$(ls -d ~/upstream/pai/Releases/v4.*/.claude 2>/dev/null | sort -V | tail -1)

   echo "=== Installing v4 hook files ==="
   for f in "$V4_SOURCE"/hooks/*.hook.ts; do
     fname=$(basename "$f")
     cp "$f" ~/.claude/hooks/
     echo "  Installed: $fname"
   done
   ```

3. Install v4 hook handlers:
   ```bash
   V4_SOURCE=$(ls -d ~/upstream/pai/Releases/v4.*/.claude 2>/dev/null | sort -V | tail -1)

   for handler in "$V4_SOURCE"/hooks/handlers/*; do
     handler_name=$(basename "$handler")
     cp "$handler" ~/.claude/hooks/handlers/
     echo "  Installed handler: $handler_name"
   done
   ```

4. Install v4 hook lib files:
   ```bash
   V4_SOURCE=$(ls -d ~/upstream/pai/Releases/v4.*/.claude 2>/dev/null | sort -V | tail -1)

   if [ -d "$V4_SOURCE/hooks/lib" ]; then
     cp -r "$V4_SOURCE/hooks/lib/"* ~/.claude/hooks/lib/ 2>/dev/null
     echo "  Updated hooks/lib"
   fi
   ```

5. Remove v3-only hook files that no longer exist in v4:
   ```bash
   V3_ONLY_HOOKS="AlgorithmTracker.hook.ts AutoWorkCreation.hook.ts CheckVersion.hook.ts SessionSummary.hook.ts StartupGreeting.hook.ts StopOrchestrator.hook.ts VoiceGate.hook.ts"
   V3_ONLY_HANDLERS="AlgorithmEnrichment.ts RebuildSkill.ts"

   echo "=== Removing v3-only hooks ==="
   for f in $V3_ONLY_HOOKS; do
     rm -f ~/.claude/hooks/"$f"
     echo "  Removed: $f"
   done

   for f in $V3_ONLY_HANDLERS; do
     rm -f ~/.claude/hooks/handlers/"$f"
     echo "  Removed handler: $f"
   done
   ```

6. The settings.json hook configuration will be updated in Phase 7 (Settings Migration).

**Verification:**
- V4 hooks present: `ls ~/.claude/hooks/*.hook.ts | wc -l` (should be ~20)
- V3-only hooks gone: `test -f ~/.claude/hooks/AlgorithmTracker.hook.ts && echo "FAIL" || echo "PASS"`
- `BuildCLAUDE.ts` exists in handlers/: `test -f ~/.claude/hooks/handlers/BuildCLAUDE.ts && echo "PASS"`
- Backup exists: `test -d ~/.claude/hooks.v3-backup && echo "PASS"`

---

### Phase 6: Install PAI System Directory

Create the new PAI/ directory with documentation, tools, and user context structure.

**Steps:**

1. Copy the PAI/ directory from v4 release (user context was already backed up in Phase 4):
   ```bash
   V4_SOURCE=$(ls -d ~/upstream/pai/Releases/v4.*/.claude 2>/dev/null | sort -V | tail -1)
   cp -r "$V4_SOURCE/PAI" ~/.claude/PAI
   echo "Installed PAI/ directory"
   ```

2. Restore user context files to the new PAI/USER/ location:
   ```bash
   if [ -d ~/.claude/.upgrade-user-context-backup ]; then
     echo "=== Restoring User Context ==="
     for f in ~/.claude/.upgrade-user-context-backup/*; do
       fname=$(basename "$f")
       if [ -f ~/.claude/PAI/USER/"$fname" ]; then
         # User file exists in v4 template too. Append user content to v4 version
         echo "Merging: $fname (v4 base + your customizations)"
         echo "" >> ~/.claude/PAI/USER/"$fname"
         echo "---" >> ~/.claude/PAI/USER/"$fname"
         echo "<!-- Restored from v3 upgrade -->" >> ~/.claude/PAI/USER/"$fname"
         cat "$f" >> ~/.claude/PAI/USER/"$fname"
       else
         # User file doesn't exist in v4. Copy it directly
         echo "Restoring: $fname"
         cp "$f" ~/.claude/PAI/USER/
       fi
     done
   fi
   ```

3. Create required subdirectories if they don't exist:
   ```bash
   mkdir -p ~/.claude/PAI/USER/SKILLCUSTOMIZATIONS
   mkdir -p ~/.claude/PAI/USER/TELOS
   mkdir -p ~/.claude/PAI/USER/PROJECTS
   mkdir -p ~/.claude/PAI/USER/WORK
   ```

**Verification:**
- PAI/ directory exists with documentation: `ls ~/.claude/PAI/*.md | head -5`
- Algorithm is present: `cat ~/.claude/PAI/Algorithm/LATEST`
- Tools are present: `ls ~/.claude/PAI/Tools/`
- User context restored: `ls ~/.claude/PAI/USER/`
- User steering rules preserved (if they existed): `test -f ~/.claude/PAI/USER/AISTEERINGRULES.md && echo "PASS" || echo "SKIP (no v3 rules found)"`

---

### Phase 7: Settings.json and CLAUDE.md Migration

Update settings.json to v4 structure and install the CLAUDE.md template system.

**Steps:**

1. Extract user identity from current settings.json:
   ```bash
   # Save user-specific fields
   jq '{
     principal: .principal,
     daidentity: .daidentity,
     env: .env
   }' ~/.claude/settings.json > ~/.claude/.upgrade-user-settings.json
   echo "Extracted user identity fields"
   cat ~/.claude/.upgrade-user-settings.json | jq '.principal.name, .daidentity.name'
   ```

2. Copy v4 settings.json template:
   ```bash
   V4_SOURCE=$(ls -d ~/upstream/pai/Releases/v4.*/.claude 2>/dev/null | sort -V | tail -1)
   cp ~/.claude/settings.json ~/.claude/settings.json.v3-backup
   cp "$V4_SOURCE/settings.json" ~/.claude/settings.json
   echo "Installed v4 settings.json template"
   ```

3. Merge user identity back into v4 settings:
   ```bash
   # Merge user fields into the v4 template
   MERGED=$(jq -s '
     .[0] as $v4 |
     .[1] as $user |
     $v4 * {
       principal: ($v4.principal * ($user.principal // {})),
       daidentity: ($v4.daidentity * ($user.daidentity // {})),
       env: ($v4.env * ($user.env // {}))
     }
   ' ~/.claude/settings.json ~/.claude/.upgrade-user-settings.json)

   echo "$MERGED" > ~/.claude/settings.json
   echo "Merged user identity into v4 settings"
   ```

4. Set version fields (the v4 template has these as null):
   ```bash
   ALGO_VER=$(cat ~/.claude/PAI/Algorithm/LATEST 2>/dev/null | tr -d '[:space:]')
   jq --arg alg "$ALGO_VER" '.paiVersion = "4.0" | .algorithmVersion = $alg' \
     ~/.claude/settings.json > /tmp/settings-versions.json
   mv /tmp/settings-versions.json ~/.claude/settings.json
   echo "Set paiVersion=4.0, algorithmVersion=$ALGO_VER"
   ```

5. Validate the merged settings:
   ```bash
   # Check it's valid JSON
   jq empty ~/.claude/settings.json 2>/dev/null && echo "JSON: valid" || echo "JSON: INVALID"

   # Check identity is preserved
   echo "Principal: $(jq -r '.principal.name' ~/.claude/settings.json)"
   echo "AI Name: $(jq -r '.daidentity.name' ~/.claude/settings.json)"
   echo "Timezone: $(jq -r '.principal.timezone' ~/.claude/settings.json)"
   echo "PAI Version: $(jq -r '.paiVersion' ~/.claude/settings.json)"
   echo "Algorithm: $(jq -r '.algorithmVersion' ~/.claude/settings.json)"
   ```

6. Install CLAUDE.md template system:
   ```bash
   V4_SOURCE=$(ls -d ~/upstream/pai/Releases/v4.*/.claude 2>/dev/null | sort -V | tail -1)

   # Back up existing CLAUDE.md
   cp ~/.claude/CLAUDE.md ~/.claude/CLAUDE.md.v3-backup 2>/dev/null

   # Install template
   cp "$V4_SOURCE/CLAUDE.md.template" ~/.claude/CLAUDE.md.template 2>/dev/null

   # Generate CLAUDE.md from template (if BuildCLAUDE.ts exists)
   if [ -f ~/.claude/PAI/Tools/BuildCLAUDE.ts ]; then
     bun ~/.claude/PAI/Tools/BuildCLAUDE.ts
     echo "CLAUDE.md generated from template"
   else
     # Fallback: copy the static CLAUDE.md from the release
     cp "$V4_SOURCE/CLAUDE.md" ~/.claude/CLAUDE.md
     echo "CLAUDE.md copied from release (no BuildCLAUDE.ts found)"
   fi
   ```

7. Verify CLAUDE.md has content (not a stub):
   ```bash
   LINES=$(wc -l < ~/.claude/CLAUDE.md)
   if [ "$LINES" -gt 10 ]; then
     echo "CLAUDE.md: $LINES lines (populated)"
   else
     echo "CLAUDE.md: $LINES lines (WARNING: may still be a stub)"
   fi
   ```

8. Fix statusline paths (v3 statusline reads from old locations):
   ```bash
   if [ -f ~/.claude/statusline-command.sh ]; then
     # Fix Algorithm LATEST path: skills/PAI/Components/Algorithm/ → PAI/Algorithm/
     sed -i 's|skills/PAI/Components/Algorithm/LATEST|PAI/Algorithm/LATEST|g' ~/.claude/statusline-command.sh

     # Fix PAI version field: .pai.version → .paiVersion
     sed -i 's|\.pai\.version|.paiVersion|g' ~/.claude/statusline-command.sh

     echo "Statusline paths updated for v4"
   fi
   ```

9. Fix the `pai` shell alias (v3 path no longer exists in v4):
   ```bash
   # The v3 alias points to skills/PAI/Tools/pai.ts, which moved to PAI/Tools/pai.ts in v4
   sed -i 's|skills/PAI/Tools/pai.ts|PAI/Tools/pai.ts|g' ~/.bashrc
   [ -f ~/.zshrc ] && sed -i 's|skills/PAI/Tools/pai.ts|PAI/Tools/pai.ts|g' ~/.zshrc
   echo "Shell alias path updated for v4"
   ```

**Verification:**
- Settings.json is valid JSON: `jq empty ~/.claude/settings.json && echo "PASS"`
- User identity preserved: `jq '.principal.name' ~/.claude/settings.json` returns the user's name
- Version fields set: `jq '{paiVersion, algorithmVersion}' ~/.claude/settings.json`
- v3 backup exists: `test -f ~/.claude/settings.json.v3-backup && echo "PASS"`
- CLAUDE.md is populated (not a stub): more than 10 lines
- CLAUDE.md.template exists: `test -f ~/.claude/CLAUDE.md.template && echo "PASS" || echo "SKIP"`
- Statusline reads correct paths: `grep 'PAI/Algorithm/LATEST' ~/.claude/statusline-command.sh && echo "PASS"`
- Shell alias points to correct path: `grep 'PAI/Tools/pai.ts' ~/.bashrc | grep -v 'skills/' && echo "PASS"`

---

### Phase 8: Agent and Memory Migration

Update agent configurations and ensure memory directories are correct.

**Steps:**

1. Install v4 agent configurations:
   ```bash
   V4_SOURCE=$(ls -d ~/upstream/pai/Releases/v4.*/.claude 2>/dev/null | sort -V | tail -1)

   # Back up current agents
   cp -r ~/.claude/agents ~/.claude/agents.v3-backup 2>/dev/null

   # Install v4 agents
   cp -r "$V4_SOURCE/agents" ~/.claude/
   echo "Installed v4 agent configurations"
   ls ~/.claude/agents/
   ```

2. Ensure memory directories exist:
   ```bash
   mkdir -p ~/.claude/MEMORY/{WORK,LEARNING,STATE,RELATIONSHIP,VOICE}
   echo "Memory directories verified"
   ```

3. Verify memory data is intact:
   ```bash
   echo "=== Memory Data ==="
   for dir in WORK LEARNING STATE RELATIONSHIP VOICE; do
     count=$(find ~/.claude/MEMORY/$dir -type f 2>/dev/null | wc -l)
     echo "  $dir: $count files"
   done
   ```

4. Install other v4 infrastructure if present:
   ```bash
   V4_SOURCE=$(ls -d ~/upstream/pai/Releases/v4.*/.claude 2>/dev/null | sort -V | tail -1)

   # Install lib/ directory (migration utilities)
   [ -d "$V4_SOURCE/lib" ] && cp -r "$V4_SOURCE/lib" ~/.claude/

   # Install PAI-Install/ (for future reference)
   [ -d "$V4_SOURCE/PAI-Install" ] && cp -r "$V4_SOURCE/PAI-Install" ~/.claude/
   ```

**Verification:**
- Agents directory has v4 agents: `ls ~/.claude/agents/`
- Memory directories all exist: `ls -d ~/.claude/MEMORY/*/`
- No memory data was lost: file counts match or exceed pre-upgrade inventory
- v3 agent backup exists: `test -d ~/.claude/agents.v3-backup && echo "PASS"`

---

### Phase 9: Voice Server Decision

Handle the voice server based on the user's current setup.

**Steps:**

1. Detect current voice setup:
   ```bash
   echo "=== Voice Server Detection ==="

   # Check for PAI Companion's Kokoro voice server (Docker)
   if docker ps 2>/dev/null | grep -q "kokoro\|chatterbox\|voice"; then
     echo "DETECTED: PAI Companion voice server (Docker/Kokoro)"
     echo "ACTION: Preserve current setup. Do not install upstream VoiceServer."
   # Check for upstream ElevenLabs voice server
   elif [ -f ~/.claude/VoiceServer/server.ts ]; then
     echo "DETECTED: Upstream ElevenLabs voice server"
     echo "ACTION: Update to v4 VoiceServer."
   # Check for systemd voice service
   elif systemctl --user is-active pai-voice >/dev/null 2>&1; then
     echo "DETECTED: Voice server running via systemd"
     echo "ACTION: Preserve current setup."
   else
     echo "DETECTED: No voice server"
     echo "ACTION: Skip voice server installation."
   fi
   ```

2. **If upstream ElevenLabs (not Companion):** Update the VoiceServer:
   ```bash
   V4_SOURCE=$(ls -d ~/upstream/pai/Releases/v4.*/.claude 2>/dev/null | sort -V | tail -1)
   if [ -d "$V4_SOURCE/VoiceServer" ]; then
     cp -r ~/.claude/VoiceServer ~/.claude/VoiceServer.v3-backup 2>/dev/null
     cp -r "$V4_SOURCE/VoiceServer" ~/.claude/
     echo "Updated VoiceServer to v4"
   fi
   ```

3. **If PAI Companion (Kokoro):** Skip upstream VoiceServer entirely. The Companion's voice system is independent and should not be overwritten.

4. **If no voice server:** Skip this phase. Voice is optional.

**Verification:**
- Voice server state matches detection (running or not, correct type)
- If updated: `test -f ~/.claude/VoiceServer/server.ts && echo "PASS"`
- If Companion: Docker voice containers still running: `docker ps | grep -i voice`
- If skipped: confirm no VoiceServer was accidentally installed

---

### Phase 9b: PAI Companion Update

If the user has PAI Companion installed, offer to update the companion's system portal pages to the latest version. This phase only updates system-managed pages and never touches user-created content.

**Steps:**

1. Detect PAI Companion installation:
   ```bash
   echo "=== PAI Companion Detection ==="
   COMPANION_DETECTED=false

   # Check for portal directory with companion system pages
   if [ -d ~/portal/skills ] || [ -d ~/portal/exchange ] || [ -d ~/portal/clipboard ]; then
     echo "  FOUND: Portal system pages"
     COMPANION_DETECTED=true
   fi

   # Check for companion Docker container
   if docker ps 2>/dev/null | grep -q "pai-portal"; then
     echo "  FOUND: pai-portal Docker container"
     COMPANION_DETECTED=true
   fi

   # Check for companion marker in identity
   if grep -q "PAI Companion setup" ~/.claude/PAI/USER/IDENTITY.md 2>/dev/null; then
     echo "  FOUND: Companion identity context"
     COMPANION_DETECTED=true
   fi

   # Check for version marker
   if [ -f ~/portal/.companion-version ]; then
     echo "  FOUND: Version marker ($(cat ~/portal/.companion-version))"
     COMPANION_DETECTED=true
   fi

   echo "  Companion detected: $COMPANION_DETECTED"
   ```

2. **If not detected:** Skip this phase. Inform the user:
   > PAI Companion is not installed. It's an optional add-on that gives your assistant a web portal for visual output, a file exchange, and a clipboard. You can install it later from [the companion repo](https://github.com/chriscantey/pai-companion).

3. **If detected:** Ask the user with AskUserQuestion (3 options):
   - **"Yes, update companion"** — Pull latest source, update system pages, rebuild Docker
   - **"No, skip companion update"** — Leave companion as-is
   - **"What is PAI Companion?"** — Explain what it is, then re-ask

4. **If user chooses yes:** Get the latest companion source:
   ```bash
   if [ -d ~/pai-companion ]; then
     echo "Updating existing companion repo..."
     git -C ~/pai-companion pull
   else
     echo "Cloning companion repo..."
     git clone https://github.com/chriscantey/pai-companion.git ~/pai-companion
   fi
   ```

5. Update system portal pages only (never touch user-created pages):
   ```bash
   echo "=== Updating System Portal Pages ==="

   # System directories to update (these ship with companion)
   SYSTEM_DIRS="skills agents context system clipboard exchange shared"

   for dir in $SYSTEM_DIRS; do
     if [ -d ~/pai-companion/companion/portal/public/$dir ]; then
       rm -rf ~/portal/$dir
       cp -r ~/pai-companion/companion/portal/public/$dir ~/portal/
       echo "  Updated: $dir/"
     fi
   done

   # Welcome page (stored separately in repo)
   if [ -d ~/pai-companion/companion/welcome ]; then
     rm -rf ~/portal/welcome
     cp -r ~/pai-companion/companion/welcome ~/portal/welcome
     echo "  Updated: welcome/"
   fi

   # Server infrastructure files
   for f in server.ts Dockerfile docker-compose.yml; do
     if [ -f ~/pai-companion/companion/portal/$f ]; then
       cp ~/pai-companion/companion/portal/$f ~/portal/$f
       echo "  Updated: $f"
     fi
   done

   # Patch the portal homepage (add new quick-links, update skip list)
   # This preserves user customizations (colors, layout, etc.)
   if [ -f ~/portal/index.html ]; then
     # Add context link if missing (inject before system link)
     if ! grep -q '/context/' ~/portal/index.html; then
       sed -i '/<a href="\/system\/" class="quick-link">/i\        <a href="/context/" class="quick-link">\n          <span class="icon">\&#129517;</span> Context\n        </a>' ~/portal/index.html
       echo "  Patched: added context quick-link"
     fi

     # Add 'context' to skip set if missing
     if ! grep -q "'context'" ~/portal/index.html; then
       sed -i "s/'agents', 'system'/'agents', 'context', 'system'/" ~/portal/index.html
       echo "  Patched: added context to skip set"
     fi
   fi

   # Update shared assets
   cp -r ~/pai-companion/companion/portal/public/shared/* ~/portal/shared/ 2>/dev/null
   echo "  Updated: shared/"

   # Write version marker
   echo "companion-$(date +%Y%m%d)" > ~/portal/.companion-version
   echo "  Version marker: $(cat ~/portal/.companion-version)"
   ```

6. Rebuild the Docker container:
   ```bash
   cd ~/portal && docker compose up -d --build
   ```

7. Wait for the container to start, then verify:
   ```bash
   sleep 3
   VM_IP=$(cat ~/.vm-ip 2>/dev/null || hostname -I | awk '{print $1}')
   PORT=$(grep PORTAL_PORT ~/.claude/.env 2>/dev/null | cut -d= -f2 || echo 8080)

   echo "=== Companion Update Verification ==="
   echo -n "Portal responds: "
   curl -sf http://$VM_IP:$PORT/ >/dev/null && echo "PASS" || echo "FAIL"

   echo -n "Skills page: "
   curl -sf http://$VM_IP:$PORT/skills/ >/dev/null && echo "PASS" || echo "FAIL"

   echo -n "Exchange page: "
   curl -sf http://$VM_IP:$PORT/exchange/ >/dev/null && echo "PASS" || echo "FAIL"

   echo -n "Docker container: "
   docker ps | grep -q pai-portal && echo "PASS" || echo "FAIL"
   ```

**Verification:**
- System pages are updated (skills, agents, exchange, clipboard all respond)
- User-created portal pages are untouched (any pages the user built are still there)
- Docker container `pai-portal` is running
- Version marker exists: `cat ~/portal/.companion-version`

---

### Phase 10: Post-Upgrade Verification

Run comprehensive checks to confirm the upgrade succeeded.

**Steps:**

1. Run the full verification:
   ```bash
   echo "=== PAI v3 → v4 Upgrade Verification ==="
   echo ""
   PASS=0
   FAIL=0
   WARN=0

   # Structure checks
   echo "--- Structure ---"

   echo -n "PAI/ directory exists: "
   test -d ~/.claude/PAI && { echo "PASS"; PASS=$((PASS+1)); } || { echo "FAIL"; FAIL=$((FAIL+1)); }

   echo -n "Algorithm installed: "
   test -f ~/.claude/PAI/Algorithm/LATEST && { echo "PASS ($(cat ~/.claude/PAI/Algorithm/LATEST))"; PASS=$((PASS+1)); } || { echo "FAIL"; FAIL=$((FAIL+1)); }

   echo -n "Skills hierarchical: "
   test -d ~/.claude/skills/Thinking && test -d ~/.claude/skills/Security && { echo "PASS"; PASS=$((PASS+1)); } || { echo "FAIL"; FAIL=$((FAIL+1)); }

   echo -n "Custom skills preserved: "
   test -d ~/.claude/skills/Custom && { echo "PASS ($(ls ~/.claude/skills/Custom/ 2>/dev/null | wc -l) skills)"; PASS=$((PASS+1)); } || { echo "WARN (no Custom/ dir)"; WARN=$((WARN+1)); }

   echo -n "No v3 flat skills remain: "
   test -d ~/.claude/skills/CORE 2>/dev/null && { echo "FAIL (CORE still exists)"; FAIL=$((FAIL+1)); } || { echo "PASS"; PASS=$((PASS+1)); }

   # Config checks
   echo ""
   echo "--- Configuration ---"

   echo -n "settings.json valid: "
   jq empty ~/.claude/settings.json 2>/dev/null && { echo "PASS"; PASS=$((PASS+1)); } || { echo "FAIL"; FAIL=$((FAIL+1)); }

   echo -n "Principal name set: "
   NAME=$(jq -r '.principal.name // empty' ~/.claude/settings.json)
   [ -n "$NAME" ] && { echo "PASS ($NAME)"; PASS=$((PASS+1)); } || { echo "FAIL"; FAIL=$((FAIL+1)); }

   echo -n "CLAUDE.md populated: "
   LINES=$(wc -l < ~/.claude/CLAUDE.md 2>/dev/null || echo 0)
   [ "$LINES" -gt 10 ] && { echo "PASS ($LINES lines)"; PASS=$((PASS+1)); } || { echo "FAIL ($LINES lines)"; FAIL=$((FAIL+1)); }

   # Hook checks
   echo ""
   echo "--- Hooks ---"

   echo -n "BuildCLAUDE.ts present: "
   test -f ~/.claude/hooks/handlers/BuildCLAUDE.ts && { echo "PASS"; PASS=$((PASS+1)); } || { echo "FAIL"; FAIL=$((FAIL+1)); }

   echo -n "v3-only hooks removed: "
   if [ -f ~/.claude/hooks/handlers/AlgorithmEnrichment.ts ] || [ -f ~/.claude/hooks/handlers/RebuildSkill.ts ]; then
     echo "FAIL (v3 hooks still present)"; FAIL=$((FAIL+1))
   else
     echo "PASS"; PASS=$((PASS+1))
   fi

   # Data checks
   echo ""
   echo "--- Data ---"

   echo -n "Memory intact: "
   test -d ~/.claude/MEMORY/WORK && test -d ~/.claude/MEMORY/LEARNING && { echo "PASS"; PASS=$((PASS+1)); } || { echo "FAIL"; FAIL=$((FAIL+1)); }

   echo -n "User context in PAI/USER/: "
   test -d ~/.claude/PAI/USER && { echo "PASS ($(ls ~/.claude/PAI/USER/ | wc -l) files)"; PASS=$((PASS+1)); } || { echo "FAIL"; FAIL=$((FAIL+1)); }

   echo -n "Backup exists: "
   BACKUP=$(cat ~/.claude/.upgrade-backup-path 2>/dev/null)
   [ -n "$BACKUP" ] && test -d "$BACKUP" && { echo "PASS ($BACKUP)"; PASS=$((PASS+1)); } || { echo "WARN"; WARN=$((WARN+1)); }

   # Safety checks
   echo ""
   echo "--- Safety ---"

   echo -n ".env preserved: "
   test -f ~/.claude/.env && { echo "PASS"; PASS=$((PASS+1)); } || { echo "WARN (no .env found)"; WARN=$((WARN+1)); }

   echo -n "Shell alias (no duplicates): "
   SHELL_RC="$HOME/.$(basename $SHELL 2>/dev/null || echo bash)rc"
   ALIAS_COUNT=$(grep -c "^alias pai=" "$SHELL_RC" 2>/dev/null || echo 0)
   if [ "$ALIAS_COUNT" -eq 1 ]; then
     echo "PASS (1 alias in $(basename $SHELL_RC))"
     PASS=$((PASS+1))
   elif [ "$ALIAS_COUNT" -gt 1 ]; then
     echo "WARN ($ALIAS_COUNT duplicate aliases in $(basename $SHELL_RC))"
     WARN=$((WARN+1))
   else
     echo "WARN (no alias found in $(basename $SHELL_RC))"
     WARN=$((WARN+1))
   fi

   echo ""
   echo "=== Results: $PASS passed, $FAIL failed, $WARN warnings ==="

   if [ "$FAIL" -eq 0 ]; then
     echo "Upgrade verification: SUCCESS"
   else
     echo "Upgrade verification: ISSUES FOUND - review failures above"
   fi
   ```

2. If any checks fail, **report them to the user** and suggest remediation. For each failure, check the backup and restore the specific component if needed.

**Verification:** All checks pass (0 failures). Warnings are acceptable (some items may not exist in every installation).

---

### Phase 11: Cleanup and Commit

Clean up temporary files and commit the upgraded state.

**Steps:**

1. Clean up shell aliases:

   The PAI installer writes a `pai` alias to `.zshrc` (macOS default shell). On Linux, some setup guides merge `.zshrc` into `.bashrc`, which can leave duplicate or stale aliases after upgrading. This step cleans up all shell configs to have one correct alias.

   ```bash
   echo "=== Shell Alias Cleanup ==="

   # Determine the correct alias path for v4
   # v3 used skills/PAI/Tools/pai.ts, v4 uses PAI/Tools/pai.ts
   PAI_TOOL="$HOME/.claude/PAI/Tools/pai.ts"
   CORRECT_ALIAS="alias pai='bun $PAI_TOOL'"

   for RC_FILE in ~/.bashrc ~/.zshrc; do
     [ -f "$RC_FILE" ] || continue

     # Count existing pai aliases
     ALIAS_COUNT=$(grep -c "^alias pai=" "$RC_FILE" 2>/dev/null || echo 0)
     MARKER_COUNT=$(grep -c "^#.*PAI.*alias" "$RC_FILE" 2>/dev/null || echo 0)

     if [ "$ALIAS_COUNT" -gt 1 ] || [ "$MARKER_COUNT" -gt 1 ]; then
       echo "  $(basename $RC_FILE): Found $ALIAS_COUNT alias(es), $MARKER_COUNT marker(s) - cleaning duplicates"

       # Remove all pai alias lines and PAI alias markers
       grep -v "^alias pai=" "$RC_FILE" | grep -v "^#.*PAI.*alias" > "${RC_FILE}.upgrade-tmp"
       mv "${RC_FILE}.upgrade-tmp" "$RC_FILE"

       # Add one clean alias
       echo "" >> "$RC_FILE"
       echo "# PAI alias" >> "$RC_FILE"
       echo "$CORRECT_ALIAS" >> "$RC_FILE"
       echo "  $(basename $RC_FILE): Cleaned and set single alias"

     elif [ "$ALIAS_COUNT" -eq 1 ]; then
       # One alias exists. Verify it points to the right path
       CURRENT=$(grep "^alias pai=" "$RC_FILE")
       if [ "$CURRENT" != "$CORRECT_ALIAS" ]; then
         grep -v "^alias pai=" "$RC_FILE" | grep -v "^#.*PAI.*alias" > "${RC_FILE}.upgrade-tmp"
         mv "${RC_FILE}.upgrade-tmp" "$RC_FILE"
         echo "" >> "$RC_FILE"
         echo "# PAI alias" >> "$RC_FILE"
         echo "$CORRECT_ALIAS" >> "$RC_FILE"
         echo "  $(basename $RC_FILE): Updated alias path"
       else
         echo "  $(basename $RC_FILE): Alias correct, no changes needed"
       fi

     elif [ "$ALIAS_COUNT" -eq 0 ]; then
       # No alias. Add one if this is the user's active shell config
       CURRENT_SHELL=$(basename "$SHELL" 2>/dev/null || echo "bash")
       if [ "$RC_FILE" = "$HOME/.${CURRENT_SHELL}rc" ]; then
         echo "" >> "$RC_FILE"
         echo "# PAI alias" >> "$RC_FILE"
         echo "$CORRECT_ALIAS" >> "$RC_FILE"
         echo "  $(basename $RC_FILE): Added alias (active shell)"
       else
         echo "  $(basename $RC_FILE): No alias, skipping (not active shell)"
       fi
     fi
   done

   # Clean up fish config if it exists (v3 wrote fish functions, v4 doesn't)
   FISH_CONFIG=~/.config/fish/config.fish
   if [ -f "$FISH_CONFIG" ] && grep -q "function pai" "$FISH_CONFIG"; then
     echo "  config.fish: Found v3 fish function - updating"
     # Remove old function block
     sed -i '/^#.*PAI.*alias/,/^end$/d' "$FISH_CONFIG"
     sed -i '/^function pai/,/^end$/d' "$FISH_CONFIG"
   fi
   ```

2. Remove v3 artifacts that are now consolidated:
   ```bash
   # The skills/PAI/ directory is replaced by the top-level PAI/ directory
   rm -rf ~/.claude/skills/PAI 2>/dev/null

   # Remove upgrade temp files (keep backups)
   rm -f ~/.claude/.upgrade-user-settings.json
   rm -f ~/.claude/.upgrade-manifest.md
   rm -f ~/.claude/.upgrade-backup-path
   ```

3. Clean up handler backups (optional, ask user):
   ```bash
   echo "Backup directories created during upgrade:"
   ls -d ~/.claude/*.v3-backup ~/.claude/hooks/handlers.v3-backup 2>/dev/null
   echo ""
   echo "These can be removed once you've verified the upgrade is working correctly."
   echo "The full backup at ~/pai-v3-backup-* is your safety net."
   ```

3. Commit the upgraded state:
   ```bash
   cd ~/.claude && git add -A && git commit -m "Upgrade complete: PAI v3 → v4"
   ```

4. Report to the user:
   ```
   Upgrade complete! Here's what changed:

   - Skills: Reorganized from 38 flat directories to 11 hierarchical categories
   - Your custom skills are preserved in skills/Custom/
   - Hooks: Updated to v4 set (BuildCLAUDE.ts added, v3-only hooks removed)
   - PAI/ directory: New system documentation and tools installed
   - CLAUDE.md: Now generated from template (auto-rebuilds on session start)
   - Settings: Your identity, timezone, and API keys are preserved
   - Memory: All session history, learning, and relationship data intact
   - Algorithm: Updated to latest version

   Full backup at: ~/pai-v3-backup-[timestamp]/

   **Important:** Exit Claude Code and start a new session. The v4 hooks
   and configuration won't fully load until you restart. You may see hook
   errors on exit — that's expected, since the current session is still
   running with v3 hook references. A fresh session will load cleanly.
   ```

**Verification:**
- Git commit exists: `git -C ~/.claude log --oneline -1` shows the upgrade commit
- No temp files remain: `ls ~/.claude/.upgrade-* 2>/dev/null` returns nothing
- skills/PAI/ is gone (replaced by top-level PAI/): `test -d ~/.claude/skills/PAI && echo "FAIL" || echo "PASS"`

---

### Rollback

If something goes wrong, you can restore from the backup:

```bash
# Find your backup
BACKUP=$(ls -d ~/pai-v3-backup-* | tail -1)
echo "Restoring from: $BACKUP"

# Restore (preserves the git history)
cd ~/.claude && git stash
rm -rf skills/ hooks/ PAI/ CLAUDE.md CLAUDE.md.template settings.json agents/ VoiceServer/ lib/ PAI-Install/
cp -r "$BACKUP"/* ~/.claude/
cd ~/.claude && git add -A && git commit -m "Rollback: restored v3 from backup"
```

Or use git:

```bash
# Find the pre-upgrade commit
git -C ~/.claude log --oneline | head -5

# Reset to the pre-upgrade state
git -C ~/.claude checkout <commit-hash> -- .
git -C ~/.claude commit -m "Rollback: reverted to v3 via git"
```
