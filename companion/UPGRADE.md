# PAI Companion: Update Instructions

> **For AI Assistants.** If you were directed here by your user to update their PAI Companion installation, follow the phases below. Each phase is independently verifiable. If interrupted, you can resume from any phase.

This updates an existing PAI Companion installation to the latest version. It refreshes system portal pages (skills catalog, agent roster, exchange, clipboard, etc.) without touching any pages the user has created.

**Prerequisites:**
- PAI Companion already installed and working
- Docker running
- Portal server (`pai-portal` container) running
- Git installed

---

### Phase 1: Pre-flight

Verify the current installation and check for the companion source repo.

**Steps:**

1. Verify the portal is running:
   ```bash
   VM_IP=$(cat ~/.vm-ip 2>/dev/null || hostname -I | awk '{print $1}')
   PORT=$(grep PORTAL_PORT ~/.claude/.env 2>/dev/null | cut -d= -f2 || echo 8080)

   echo "=== Current Installation ==="
   echo -n "Portal server: "
   curl -sf http://$VM_IP:$PORT/ >/dev/null && echo "RUNNING" || echo "NOT RUNNING"

   echo -n "Docker container: "
   docker ps | grep -q pai-portal && echo "RUNNING" || echo "NOT RUNNING"
   ```

2. Check current version:
   ```bash
   if [ -f ~/portal/.companion-version ]; then
     echo "Current version: $(cat ~/portal/.companion-version)"
   else
     echo "No version marker found (pre-marker installation)"
   fi
   ```

3. Inventory user-created portal pages (these will NOT be touched):
   ```bash
   echo "=== User Portal Pages (will be preserved) ==="
   SYSTEM_DIRS="skills agents context system clipboard exchange shared welcome .thumbs"
   for dir in ~/portal/*/; do
     dir_name=$(basename "$dir")
     if ! echo "$SYSTEM_DIRS" | grep -qw "$dir_name"; then
       echo "  USER: $dir_name/"
     fi
   done
   ```

**Verification:** Portal is running. Docker container `pai-portal` is active.

**STOP if:** Portal is not running or Docker is not available. Fix the underlying issue first.

---

### Phase 2: Get Latest Source

Pull the latest companion source code.

**Steps:**

1. Update or clone the companion repo:
   ```bash
   if [ -d ~/pai-companion ]; then
     echo "Updating existing companion repo..."
     git -C ~/pai-companion pull
     echo "Updated to: $(git -C ~/pai-companion log --oneline -1)"
   else
     echo "Cloning companion repo..."
     git clone https://github.com/chriscantey/pai-companion.git ~/pai-companion
     echo "Cloned: $(git -C ~/pai-companion log --oneline -1)"
   fi
   ```

**Verification:** `git -C ~/pai-companion log --oneline -1` shows a recent commit.

---

### Phase 3: Update System Pages

Replace system-managed portal pages with the latest versions. User-created pages are never touched.

**Steps:**

1. Update system portal directories:
   ```bash
   echo "=== Updating System Portal Pages ==="

   SYSTEM_DIRS="skills agents context system clipboard exchange shared"

   for dir in $SYSTEM_DIRS; do
     if [ -d ~/pai-companion/companion/portal/public/$dir ]; then
       rm -rf ~/portal/$dir
       cp -r ~/pai-companion/companion/portal/public/$dir ~/portal/
       echo "  Updated: $dir/"
     else
       echo "  Skipped: $dir/ (not in source)"
     fi
   done
   ```

2. Update the welcome page:
   ```bash
   if [ -d ~/pai-companion/companion/welcome ]; then
     rm -rf ~/portal/welcome
     cp -r ~/pai-companion/companion/welcome ~/portal/welcome
     echo "  Updated: welcome/"
   fi
   ```

3. Update server infrastructure files:
   ```bash
   for f in server.ts Dockerfile docker-compose.yml; do
     if [ -f ~/pai-companion/companion/portal/$f ]; then
       cp ~/pai-companion/companion/portal/$f ~/portal/$f
       echo "  Updated: $f"
     fi
   done
   ```

4. Patch the portal homepage (preserves user customizations like colors and layout):
   ```bash
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
   ```

**Verification:** System directories in `~/portal/` have been refreshed. User directories are untouched (compare against the inventory from Phase 1).

---

### Phase 4: Rebuild Docker Container

Rebuild and restart the portal container with the updated files.

**Steps:**

1. Rebuild and restart:
   ```bash
   cd ~/portal && docker compose up -d --build
   ```

2. Write the version marker:
   ```bash
   echo "companion-$(date +%Y%m%d)" > ~/portal/.companion-version
   echo "Version marker: $(cat ~/portal/.companion-version)"
   ```

3. Wait for startup and verify:
   ```bash
   sleep 3
   docker ps | grep pai-portal
   ```

**Verification:** `docker ps` shows `pai-portal` running with a recent start time.

---

### Phase 5: Verify

Run the full verification to confirm everything is working.

**Steps:**

1. Run verification checks:
   ```bash
   VM_IP=$(cat ~/.vm-ip 2>/dev/null || hostname -I | awk '{print $1}')
   PORT=$(grep PORTAL_PORT ~/.claude/.env 2>/dev/null | cut -d= -f2 || echo 8080)

   echo "=== PAI Companion Update Verification ==="
   echo ""

   PASS=0
   FAIL=0

   echo -n "Portal responds: "
   curl -sf http://$VM_IP:$PORT/ >/dev/null && { echo "PASS"; PASS=$((PASS+1)); } || { echo "FAIL"; FAIL=$((FAIL+1)); }

   echo -n "Skills page: "
   curl -sf http://$VM_IP:$PORT/skills/ >/dev/null && { echo "PASS"; PASS=$((PASS+1)); } || { echo "FAIL"; FAIL=$((FAIL+1)); }

   echo -n "Agents page: "
   curl -sf http://$VM_IP:$PORT/agents/ >/dev/null && { echo "PASS"; PASS=$((PASS+1)); } || { echo "FAIL"; FAIL=$((FAIL+1)); }

   echo -n "Exchange page: "
   curl -sf http://$VM_IP:$PORT/exchange/ >/dev/null && { echo "PASS"; PASS=$((PASS+1)); } || { echo "FAIL"; FAIL=$((FAIL+1)); }

   echo -n "Clipboard page: "
   curl -sf http://$VM_IP:$PORT/clipboard/ >/dev/null && { echo "PASS"; PASS=$((PASS+1)); } || { echo "FAIL"; FAIL=$((FAIL+1)); }

   echo -n "Welcome page: "
   curl -sf http://$VM_IP:$PORT/welcome/ >/dev/null && { echo "PASS"; PASS=$((PASS+1)); } || { echo "FAIL"; FAIL=$((FAIL+1)); }

   echo -n "Docker container: "
   docker ps | grep -q pai-portal && { echo "PASS"; PASS=$((PASS+1)); } || { echo "FAIL"; FAIL=$((FAIL+1)); }

   echo -n "Version marker: "
   test -f ~/portal/.companion-version && { echo "PASS ($(cat ~/portal/.companion-version))"; PASS=$((PASS+1)); } || { echo "FAIL"; FAIL=$((FAIL+1)); }

   echo ""
   echo "=== Results: $PASS passed, $FAIL failed ==="

   if [ "$FAIL" -eq 0 ]; then
     echo "Update verification: SUCCESS"
   else
     echo "Update verification: ISSUES FOUND - review failures above"
   fi
   ```

2. Verify user pages are intact:
   ```bash
   echo ""
   echo "=== User Pages (should be unchanged) ==="
   SYSTEM_DIRS="skills agents context system clipboard exchange shared welcome .thumbs"
   for dir in ~/portal/*/; do
     dir_name=$(basename "$dir")
     if ! echo "$SYSTEM_DIRS" | grep -qw "$dir_name"; then
       echo "  $dir_name/ — present"
     fi
   done
   ```

3. Report to the user:
   ```
   Companion update complete!

   - System pages refreshed: skills, agents, exchange, clipboard, welcome, context, system
   - Your custom portal pages are untouched
   - Docker container rebuilt with latest server code
   - Version: [version marker]

   Portal: http://<VM_IP>:<PORT>/
   ```

**Verification:** All system pages respond. User pages are still present. No failures in the checklist.
