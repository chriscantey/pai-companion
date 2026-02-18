# PAI Companion: Setup Instructions

> **For AI Assistants.** If you were directed here by your user to set up their system, follow the phases below. Each phase is independently verifiable. If interrupted, you can resume from any phase.

**Prerequisites (must already be installed):** See [PREREQUISITES.md](PREREQUISITES.md)
- A Debian or Ubuntu VM (any hypervisor: UTM, VMware, VirtualBox, Proxmox, etc.)
- curl, git, and zip
- Bun runtime
- Claude Code installed and authenticated
- Docker installed and working without sudo
- PAI v3.0 installed

**Where are the companion files?** Either cloned to `~/pai-companion/` or available at the GitHub raw URL. Read files from whichever location your user directed you to.

---

### Phase 0: Linux Adaptation

The upstream PAI statusline uses macOS-specific syntax (`stat -f %m` for file mtime). On Linux, this returns filesystem info instead of modification times, breaking all cache-driven sections (location, weather, quotes). The patch script detects what needs fixing and applies only the relevant fixes.

**What it patches (auto-detected):**
- `stat -f %m` calls replaced with cross-platform `get_mtime()` helper (all versions)
- `tr ' ' '─'` replaced with `repeat_dash()` for multibyte-safe rendering (extended versions only)
- macOS Keychain OAuth replaced with `~/.claude/.credentials.json` fallback (extended versions only)

**Steps:**
1. Run the statusline patch script:
   ```bash
   bash ~/pai-companion/companion/patches/statusline-linux.sh
   ```
2. Verify by running it again (should report no fixes needed):
   ```bash
   bash ~/pai-companion/companion/patches/statusline-linux.sh
   ```

**Verification:** The second run reports "No fixes needed — statusline is already Linux-compatible." The script is idempotent and safe to run on any PAI version.

---

### Phase 1: System Discovery and IP Configuration

Detect the VM's IP address so all URLs use the correct address (not localhost).

**Steps:**
1. Detect the VM IP:
   ```bash
   hostname -I | awk '{print $1}'
   ```
2. Store it persistently:
   ```bash
   hostname -I | awk '{print $1}' > ~/.vm-ip
   ```
3. Create or update `~/.claude/.env` with:
   ```
   VM_IP=<detected IP>
   PORTAL_PORT=8080
   ```
   (Append to the file if it already exists. Do not overwrite existing entries.)
4. Verify the IP is reachable by confirming the file exists:
   ```bash
   cat ~/.vm-ip
   ```

**Verification:** `~/.vm-ip` contains a valid IP address (not empty, not 127.0.0.1).

---

### Phase 2: Directory Conventions

Create the organized home directory structure.

**Steps:**
1. Run the directory setup script:
   ```bash
   bash ~/pai-companion/companion/scripts/setup-dirs.sh
   ```
2. Verify directories exist:
   ```bash
   ls -d ~/portal ~/exchange ~/work ~/data ~/upstream
   ```

**Verification:** All five directories exist.

---

### Phase 3: Portal Server (Docker)

Deploy the portal server as a Docker container. This serves web content from `~/portal/` and provides the file exchange.

**Steps:**
1. Copy the portal public files (homepage, clipboard, exchange UI) into `~/portal/`:
   ```bash
   cp -r ~/pai-companion/companion/portal/public/* ~/portal/
   ```
2. Copy the welcome page:
   ```bash
   cp -r ~/pai-companion/companion/welcome ~/portal/welcome
   ```
3. Copy Docker files to `~/portal/`:
   ```bash
   cp ~/pai-companion/companion/portal/server.ts ~/portal/server.ts
   cp ~/pai-companion/companion/portal/Dockerfile ~/portal/Dockerfile
   cp ~/pai-companion/companion/portal/docker-compose.yml ~/portal/docker-compose.yml
   ```
4. Build and start the container:
   ```bash
   cd ~/portal && docker compose up -d --build
   ```
5. Verify the server is running:
   ```bash
   curl -f http://$(cat ~/.vm-ip):8080/
   ```

**Verification:** The curl command returns HTML content (the portal homepage). `docker ps` shows `pai-portal` running.

---

### Phase 4: Clipboard Verification

The clipboard page was deployed in Phase 3. Verify it works.

**Steps:**
1. Test the clipboard URL:
   ```bash
   curl -f http://$(cat ~/.vm-ip):8080/clipboard/
   ```

**Verification:** Returns HTML content with "Clipboard" in the title.

---

### Phase 5: File Exchange Verification

The exchange was deployed in Phase 3. Verify it works.

**Steps:**
1. Test the exchange page:
   ```bash
   curl -f http://$(cat ~/.vm-ip):8080/exchange/
   ```
2. Test the exchange API:
   ```bash
   curl -s http://$(cat ~/.vm-ip):8080/api/exchange | head -c 100
   ```

**Verification:** Exchange page returns HTML. API returns a JSON array (possibly empty).

---

### Phase 6: Extended Core Context

This is the most important phase. It teaches the AI assistant about the infrastructure that was just set up.

**Read the VM IP first:**
```bash
VM_IP=$(cat ~/.vm-ip)
```

You will need to replace `{VM_IP}` with the actual IP in the content below.

**Step 6a: Append to identity file**

Read `~/pai-companion/companion/context/identity-additions.md`, replace all `{VM_IP}` with the actual VM IP, and append the result to `~/.claude/skills/PAI/USER/IDENTITY.md`.

If `IDENTITY.md` does not exist, create it. (Fresh PAI installs may only have `DAIDENTITY.md`.) If it does exist, do NOT overwrite — append with a clear separator:
```
---
<!-- Added by PAI Companion setup -->
```

**Step 6b: Append to steering rules**

Read `~/pai-companion/companion/context/steering-rules.md`, replace all `{VM_IP}` with the actual VM IP, and append the result to `~/.claude/skills/PAI/USER/AISTEERINGRULES.md`.

Do NOT overwrite the existing content. Append with a clear separator.

**Step 6c: Create design system file**

Copy `~/pai-companion/companion/context/design-system.md` to `~/.claude/skills/PAI/USER/DESIGN.md`.

**Step 6d: Update settings.json contextFiles**

Ensure `~/.claude/settings.json` includes `DESIGN.md` in the `contextFiles` array. Read the current settings.json, and if `USER/DESIGN.md` is not already in `contextFiles`, add it. Use `jq` or careful JSON editing. Do not break the existing settings.

**Verification:**
- `grep "VM_IP" ~/.claude/skills/PAI/USER/IDENTITY.md` should NOT match (all {VM_IP} replaced with actual IP)
- `grep -i "Visual-first" ~/.claude/skills/PAI/USER/AISTEERINGRULES.md` should match
- `test -f ~/.claude/skills/PAI/USER/DESIGN.md` should succeed
- The actual VM IP should appear in the identity and steering rules files

---

### Phase 7: Document Creation Methodology

This was included in the design system file (Phase 6c). The methodology section in `DESIGN.md` teaches the assistant how to create styled HTML pages.

**Verification:** `grep "Document Creation" ~/.claude/skills/PAI/USER/DESIGN.md` returns a match.

---

### Phase 8: Upstream Repos and Algorithm Update

Set up upstream reference repositories and install the latest Algorithm.

**Steps:**
1. Clone upstream PAI:
   ```bash
   git clone https://github.com/danielmiessler/PAI.git ~/upstream/pai
   ```
   (If already exists, run `git -C ~/upstream/pai pull` instead)

2. Clone upstream Algorithm:
   ```bash
   git clone https://github.com/danielmiessler/TheAlgorithm.git ~/upstream/TheAlgorithm
   ```
   (If already exists, run `git -C ~/upstream/TheAlgorithm pull` instead)

3. Install the latest Algorithm from the upstream repo (never downgrade):
   ```bash
   ALG_DIR=~/.claude/skills/PAI/Components/Algorithm

   # Read currently installed version (from PAI v3.0)
   CURRENT_VER=""
   if [ -f "$ALG_DIR/LATEST" ]; then
     CURRENT_VER=$(cat "$ALG_DIR/LATEST" | sed 's/^v//')
   fi

   # Find the true latest by checking BOTH upstream clone AND local versions
   # This prevents oddly-named upstream files from confusing sort -V
   ALL_VERSIONS=""
   for f in ~/upstream/TheAlgorithm/versions/TheAlgorithm_v*.md "$ALG_DIR"/v*.md; do
     [ -f "$f" ] || continue
     ver=$(basename "$f" | sed 's/^TheAlgorithm_v//;s/^v//;s/\.md$//')
     # Only accept clean version numbers (digits and dots)
     if echo "$ver" | grep -qE '^[0-9]+(\.[0-9]+)*$'; then
       ALL_VERSIONS="$ALL_VERSIONS $ver"
     fi
   done

   BEST_VER=$(printf '%s\n' $ALL_VERSIONS | sort -V | tail -1)

   if [ -n "$BEST_VER" ]; then
     # Copy upstream version file if it exists and we don't have it
     UPSTREAM_FILE=~/upstream/TheAlgorithm/versions/TheAlgorithm_v${BEST_VER}.md
     if [ -f "$UPSTREAM_FILE" ] && [ ! -f "$ALG_DIR/v${BEST_VER}.md" ]; then
       cp "$UPSTREAM_FILE" "$ALG_DIR/v${BEST_VER}.md"
     fi

     # Only update LATEST if the best version is newer than what's installed
     if [ -z "$CURRENT_VER" ]; then
       echo "v${BEST_VER}" > "$ALG_DIR/LATEST"
       echo "Algorithm: installed v${BEST_VER}"
     elif [ "$BEST_VER" != "$CURRENT_VER" ]; then
       NEWER=$(printf '%s\n%s\n' "$CURRENT_VER" "$BEST_VER" | sort -V | tail -1)
       if [ "$NEWER" = "$BEST_VER" ]; then
         echo "v${BEST_VER}" > "$ALG_DIR/LATEST"
         echo "Algorithm: upgraded from v${CURRENT_VER} to v${BEST_VER}"
       else
         echo "Algorithm: keeping v${CURRENT_VER} (best available is v${BEST_VER})"
       fi
     else
       echo "Algorithm: v${CURRENT_VER} is already the latest"
     fi
   else
     if [ -n "$CURRENT_VER" ]; then
       echo "Algorithm: keeping v${CURRENT_VER} (no valid versions found upstream)"
     else
       echo "WARNING: No Algorithm version found. PAI v3.0 should have installed one."
     fi
   fi
   ```

4. Rebuild the dynamic core (if the build tool exists):
   ```bash
   [ -f ~/.claude/skills/PAI/Tools/CreateDynamicCore.ts ] && bun ~/.claude/skills/PAI/Tools/CreateDynamicCore.ts
   ```

**Verification:**
- `git -C ~/upstream/pai log --oneline -1` shows a recent commit
- `git -C ~/upstream/TheAlgorithm log --oneline -1` shows a recent commit
- `cat ~/.claude/skills/PAI/Components/Algorithm/LATEST` shows a version (e.g. `v1.6.0`) — never lower than what PAI shipped with
- `test -f ~/.claude/skills/PAI/SKILL.md` succeeds (dynamic core rebuilt)

---

### Phase 9: Local Git Tracking

Initialize git repos for local version tracking. No remote repos needed.

**Steps:**
1. Initialize (if needed) and commit `~/.claude/`:
   ```bash
   cd ~/.claude && git init 2>/dev/null
   git -C ~/.claude config user.email "local@vm"
   git -C ~/.claude config user.name "$(jq -r '.principal.name // "User"' ~/.claude/settings.json)"
   cd ~/.claude && git add -A && git commit -m "PAI Companion: post-setup snapshot" --allow-empty
   ```

2. Initialize `~/work/` as a git repo:
   ```bash
   cd ~/work && git init
   git -C ~/work config user.email "local@vm"
   git -C ~/work config user.name "$(jq -r '.principal.name // "User"' ~/.claude/settings.json)"
   cd ~/work && git add -A && git commit -m "Initial commit" --allow-empty
   ```

**Verification:**
- `git -C ~/.claude log --oneline -1` shows a commit
- `git -C ~/work log --oneline -1` shows a commit

---

### Phase 10: Maintenance Cron Jobs

Install automated maintenance tasks.

**Steps:**
1. Run the cron setup script:
   ```bash
   bash ~/pai-companion/companion/scripts/setup-cron.sh
   ```
2. Verify installation:
   ```bash
   crontab -l | grep "daily snapshot"
   ```

**Verification:** The crontab contains the "daily snapshot" entry.

---

### Phase 11: Welcome Experience and Final Verification

**Steps:**
1. Verify the welcome page is accessible:
   ```bash
   curl -f http://$(cat ~/.vm-ip):8080/welcome/
   ```

2. Run the full verification checklist:

```bash
echo "=== PAI Companion Verification ==="
echo ""

# Phase 0
echo -n "Statusline patched: "
bash ~/pai-companion/companion/patches/statusline-linux.sh 2>&1 | grep -q "No fixes needed\|issue(s) fixed" && echo "PASS" || echo "FAIL"

# Phase 1
echo -n "VM IP configured: "
test -s ~/.vm-ip && echo "PASS ($(cat ~/.vm-ip))" || echo "FAIL"

# Phase 2
echo -n "Directories exist: "
test -d ~/portal && test -d ~/exchange && test -d ~/work && test -d ~/data && test -d ~/upstream && echo "PASS" || echo "FAIL"

# Phase 3
echo -n "Portal server running: "
curl -sf http://$(cat ~/.vm-ip):8080/ >/dev/null 2>&1 && echo "PASS" || echo "FAIL"

# Phase 4
echo -n "Clipboard page: "
curl -sf http://$(cat ~/.vm-ip):8080/clipboard/ >/dev/null 2>&1 && echo "PASS" || echo "FAIL"

# Phase 5
echo -n "Exchange page: "
curl -sf http://$(cat ~/.vm-ip):8080/exchange/ >/dev/null 2>&1 && echo "PASS" || echo "FAIL"

# Phase 6
echo -n "Steering rules installed: "
grep -qi "Visual-first" ~/.claude/skills/PAI/USER/AISTEERINGRULES.md 2>/dev/null && echo "PASS" || echo "FAIL"

echo -n "Design system installed: "
test -f ~/.claude/skills/PAI/USER/DESIGN.md && echo "PASS" || echo "FAIL"

echo -n "Identity updated: "
grep -q "Portal" ~/.claude/skills/PAI/USER/IDENTITY.md 2>/dev/null && echo "PASS" || echo "FAIL"

# Phase 7
echo -n "Design methodology: "
grep -q "Document Creation" ~/.claude/skills/PAI/USER/DESIGN.md 2>/dev/null && echo "PASS" || echo "FAIL"

# Phase 8
echo -n "Upstream PAI: "
git -C ~/upstream/pai log --oneline -1 >/dev/null 2>&1 && echo "PASS" || echo "FAIL"

echo -n "Upstream Algorithm: "
git -C ~/upstream/TheAlgorithm log --oneline -1 >/dev/null 2>&1 && echo "PASS" || echo "FAIL"

echo -n "Algorithm installed: "
test -s ~/.claude/skills/PAI/Components/Algorithm/LATEST && echo "PASS ($(cat ~/.claude/skills/PAI/Components/Algorithm/LATEST))" || echo "FAIL"

# Phase 9
echo -n "Git tracking (.claude): "
git -C ~/.claude log --oneline -1 >/dev/null 2>&1 && echo "PASS" || echo "FAIL"

echo -n "Git tracking (work): "
git -C ~/work log --oneline -1 >/dev/null 2>&1 && echo "PASS" || echo "FAIL"

# Phase 10
echo -n "Cron jobs: "
crontab -l 2>/dev/null | grep -q "daily snapshot" && echo "PASS" || echo "FAIL"

# Phase 11
echo -n "Welcome page: "
curl -sf http://$(cat ~/.vm-ip):8080/welcome/ >/dev/null 2>&1 && echo "PASS" || echo "FAIL"

# Safety checks
echo ""
echo "=== Safety Checks ==="
echo -n "No localhost in identity: "
grep -q "http://localhost" ~/.claude/skills/PAI/USER/IDENTITY.md 2>/dev/null && echo "FAIL (found localhost URL)" || echo "PASS"

echo -n "Docker container running: "
docker ps 2>/dev/null | grep -q "portal" && echo "PASS" || echo "FAIL"

echo ""
echo "=== Verification Complete ==="
```

3. Report results to the user in plain language. Show the portal URL and exchange URL prominently.

**Tell the user:**
> Setup is complete! Here's what you have:
>
> - **Portal:** http://<VM_IP>:8080/ (your AI-created web pages appear here)
> - **Exchange:** http://<VM_IP>:8080/exchange/ (drag and drop files here)
> - **Clipboard:** http://<VM_IP>:8080/clipboard/ (copyable text from your assistant)
> - **Welcome guide:** http://<VM_IP>:8080/welcome/ (getting started prompts)
>
> Open any of these URLs in your browser on your host machine. Try asking me to create something for you!
