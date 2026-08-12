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
   SYSTEM_DIRS="skills agents context system clipboard exchange shared welcome algorithm hooks identity isas knowledge observability plugins reflections relationships sessions settings signals tasks .thumbs"
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

   SYSTEM_DIRS="skills agents context system clipboard exchange shared welcome algorithm hooks identity isas knowledge observability plugins reflections relationships sessions settings signals tasks"

   for dir in $SYSTEM_DIRS; do
     if [ ! -d ~/portal/$dir ]; then
       echo "  Skipped: $dir/ (not installed, leaving it that way)"
     elif [ -d ~/pai-companion/companion/portal/public/$dir ]; then
       rm -rf ~/portal/$dir
       cp -r ~/pai-companion/companion/portal/public/$dir ~/portal/
       echo "  Updated: $dir/"
     else
       echo "  Skipped: $dir/ (not in source)"
     fi
   done
   ```

   **Refresh, never re-add.** A page that is not in `~/portal/` was removed on purpose.
   A minimal install (`companion/portal/minimal/`) deliberately carries only home, clipboard,
   and exchange. Restoring the System hub underneath someone would undo that silently, so the
   loop above updates what is installed and leaves the rest alone.

2. Update server infrastructure files and the home-screen app assets:
   ```bash
   for f in server.ts Dockerfile docker-compose.yml; do
     if [ -f ~/pai-companion/companion/portal/$f ]; then
       cp ~/pai-companion/companion/portal/$f ~/portal/$f
       echo "  Updated: $f"
     fi
   done

   for f in manifest.webmanifest icon.svg icon-192.png icon-512.png icon-maskable-512.png apple-touch-icon.png; do
     if [ -f ~/pai-companion/companion/portal/public/$f ]; then
       # Do not clobber custom artwork: only add what is missing.
       if [ -f ~/portal/$f ]; then
         echo "  Kept:    $f (already present)"
       else
         cp ~/pai-companion/companion/portal/public/$f ~/portal/$f
         echo "  Added:   $f"
       fi
     fi
   done
   ```

3. If the install predates PWA support, its pages have no manifest or home-screen icon tags.
   Check the homepage:
   ```bash
   grep -q 'rel="manifest"' ~/portal/index.html && echo "PWA tags present" || echo "PWA tags MISSING"
   ```
   If missing, insert this block into the `<head>` of **`~/portal/index.html` only**, just
   before its `<title>` line, which is where the shipped pages carry it. Every other system
   page was replaced wholesale in step 1 and already has the tags, and pages the user wrote
   themselves are not ours to edit. Then tell them they can add the portal to their phone's
   home screen (Phase 5b of INSTALL.md):
   ```html
   <link rel="icon" type="image/svg+xml" href="/icon.svg">
   <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png">
   <link rel="apple-touch-icon" href="/apple-touch-icon.png">
   <link rel="manifest" href="/manifest.webmanifest">
   <meta name="theme-color" content="#0d1220">
   <meta name="apple-mobile-web-app-capable" content="yes">
   <meta name="mobile-web-app-capable" content="yes">
   <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
   <meta name="apple-mobile-web-app-title" content="Portal">
   ```

4. Patch the portal homepage if it still has the standard quick-links. Read `~/portal/index.html`. If it contains quick-links for `/skills/`, `/agents/`, and `/system/` but NOT `/context/`, add a context link before the system link:

   ```html
   <a href="/context/" class="quick-link">
     <span class="icon">&#129517;</span> Context
   </a>
   ```

   Also add `'context'` to the `skip` Set in the JavaScript if it's missing.

   If the homepage doesn't have the standard quick-links structure, skip this step.

5. Update shared assets:
   ```bash
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

   echo -n "Exchange page: "
   curl -sf http://$VM_IP:$PORT/exchange/ >/dev/null && { echo "PASS"; PASS=$((PASS+1)); } || { echo "FAIL"; FAIL=$((FAIL+1)); }

   echo -n "Clipboard page: "
   curl -sf http://$VM_IP:$PORT/clipboard/ >/dev/null && { echo "PASS"; PASS=$((PASS+1)); } || { echo "FAIL"; FAIL=$((FAIL+1)); }

   # Optional pages: only checked when installed. A minimal install (see
   # portal/minimal/README.md) has none of them, and Phase 3 correctly refuses to
   # re-add them, so verifying them unconditionally would report FAIL on an upgrade
   # that worked exactly as designed.
   for page in skills agents welcome; do
     echo -n "$(echo $page | sed 's/^./\U&/') page: "
     if [ ! -d ~/portal/$page ]; then
       echo "SKIP (not installed)"
     else
       curl -sf http://$VM_IP:$PORT/$page/ >/dev/null && { echo "PASS"; PASS=$((PASS+1)); } || { echo "FAIL"; FAIL=$((FAIL+1)); }
     fi
   done

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
   SYSTEM_DIRS="skills agents context system clipboard exchange shared welcome algorithm hooks identity isas knowledge observability plugins reflections relationships sessions settings signals tasks .thumbs"
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
