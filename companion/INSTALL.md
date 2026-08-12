# PAI Companion: Setup Instructions

> **For AI Assistants.** If you were directed here by your user to set up their system, follow the phases below. Each phase is independently verifiable. If interrupted, you can resume from any phase.

**Prerequisites (must already be installed):** See [PREREQUISITES.md](PREREQUISITES.md)
- A Debian or Ubuntu VM (any hypervisor: UTM, VMware, VirtualBox, Proxmox, etc.)
- curl, git, and zip
- Bun runtime
- Claude Code installed and authenticated
- Docker installed and working without sudo
- PAI v5.0.0 installed, pinned per the [PAI 5 setup guide](https://chriscantey.com/posts/2026-05-12-setting-up-your-personal-ai-assistant-pai-5/) (this package is tested against exactly that version)

**Where are the companion files?** Either cloned to `~/pai-companion/` or available at the GitHub raw URL. Read files from whichever location your user directed you to.

---

### Phase 0: Linux Adaptation Check

PAI v5.0.0 fixed the old PAI 3/4 Linux quirks upstream (statusline `stat`, multibyte `tr`, Keychain OAuth). What v5 still needs on Linux is covered by the [PAI 5 Linux adaptation](https://gist.github.com/chriscantey/e2f64257ec3c8cbe07898f6718636332), which the setup guide applies in its Step 7. This phase just verifies it happened.

**Steps:**
1. Verify the case-fix symlinks exist:
   ```bash
   test -L ~/.claude/PAI/Pulse && test -L ~/.claude/PAI/Tools && echo "symlinks OK"
   ```
2. If that check fails, have the assistant read and apply the adaptation gist above before continuing.

**Verification:** The symlink check prints "symlinks OK".

**Legacy note:** `patches/statusline-linux.sh` remains in this repo for PAI 3/4 installs only. Do not run it on v5. It self-detects and reports "No fixes needed" there, but it has no purpose on v5.

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
1. Copy the portal public files (homepage, the System hub, the welcome page, and all portal pages) into `~/portal/`:
   ```bash
   cp -r ~/pai-companion/companion/portal/public/* ~/portal/
   ```
2. Copy Docker files to `~/portal/`:
   ```bash
   cp ~/pai-companion/companion/portal/server.ts ~/portal/server.ts
   cp ~/pai-companion/companion/portal/Dockerfile ~/portal/Dockerfile
   cp ~/pai-companion/companion/portal/docker-compose.yml ~/portal/docker-compose.yml
   ```
3. Build and start the container:
   ```bash
   cd ~/portal && docker compose up -d --build
   ```
4. Verify the server is running:
   ```bash
   curl -f http://$(cat ~/.vm-ip):8080/
   ```

**Verification:** The curl command returns HTML content (the portal homepage). `docker ps` shows `pai-portal` running.

**Option: minimal portal.** The System hub (eighteen of those pages) reads PAI v5.0.0's own
directory layout. On anything else it shows empty pages, or describes a structure that is not
there, which is worse. So there is a minimal variant: home, clipboard, and exchange only, and
nothing that assumes what is underneath.

**When to take it.** The prerequisites above ask for PAI v5.0.0 because that is what the full
package is tested against. Take the minimal path when that is not what the user has:

| Their system | Take minimal? | Also skip |
|--------------|---------------|-----------|
| PAI v5.0.0 | No, install the full portal | nothing |
| A newer LifeOS, or a PAI fork | Yes | Phase 8 |
| No PAI-family install at all, just wants a portal | Yes | Phases 0, 6, 8, 9, 10b, and see below |

Phases 0, 6, 8, 9 and 10b all read or write `~/.claude/PAI/...`, `AISTEERINGRULES.md`,
`DESIGN.md`, or `settings.json`. On a system without that tree they either fail or create
files nothing reads. Phase 6 is the one worth replacing rather than skipping: its whole job is
telling the assistant the portal exists, so put the equivalent instruction wherever that
assistant reads its own startup context.

**One more step with no PAI tree at all:** `docker-compose.yml` bind-mounts
`${HOME}/.claude/skills` and `${HOME}/.claude/agents`. If those paths do not exist, Docker
creates them as **root-owned** empty directories inside the user's home. Delete those two
lines (and, per `portal/minimal/README.md`, the other three read-only mounts) before the
first `docker compose up`.

Do this between steps 2 and 3.

**Replace step 1 above** (do not run it and then delete). Copying everything and removing
the difference would mean an `rm -rf` over names like `tasks/`, `settings/` and `knowledge/`,
which are ordinary words a user may already have used for their own pages. Copy only what the
minimal portal needs instead, so nothing is ever deleted:

```bash
mkdir -p ~/portal
cp -r ~/pai-companion/companion/portal/public/clipboard ~/portal/
cp -r ~/pai-companion/companion/portal/public/exchange  ~/portal/
cp -r ~/pai-companion/companion/portal/public/shared    ~/portal/
cp ~/pai-companion/companion/portal/public/manifest.webmanifest ~/portal/
cp ~/pai-companion/companion/portal/public/icon.svg ~/portal/
cp ~/pai-companion/companion/portal/public/icon-192.png ~/portal/
cp ~/pai-companion/companion/portal/public/icon-512.png ~/portal/
cp ~/pai-companion/companion/portal/public/icon-maskable-512.png ~/portal/
cp ~/pai-companion/companion/portal/public/apple-touch-icon.png ~/portal/
cp ~/pai-companion/companion/portal/minimal/index.html ~/portal/index.html
```

Details, how to add pages back, and what the leftover `/api/*` routes still expose: `companion/portal/minimal/README.md`. Read that last part before putting the portal on any network you do not control.

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

### Phase 5b: Home-Screen App (PWA)

The portal ships as an installable web app. Added to a phone's home screen it opens full
screen with its own icon and no browser chrome, which is what makes it feel like an app
rather than a bookmark. Nothing needs building, because the assets deployed in Phase 3 are all of it.

**What was deployed:**

| File | Role |
|------|------|
| `manifest.webmanifest` | Name, standalone display mode, theme colour, icon set |
| `icon.svg` | Scalable icon, used as the browser favicon |
| `icon-192.png`, `icon-512.png` | Android / Chrome install icons |
| `icon-maskable-512.png` | Full-bleed square for Android's adaptive mask. The rounded-corner icons have transparent corners, which a mask would expose as notches |
| `apple-touch-icon.png` | 180x180, the icon iOS puts on the home screen. Opaque on purpose, iOS does not composite alpha |

Every portal page carries the matching `<link rel="manifest">`, `apple-touch-icon`,
`theme-color`, and `apple-mobile-web-app-*` tags in its head.

**Steps:**
1. Verify the manifest is served with the right content type:
   ```bash
   curl -sI http://$(cat ~/.vm-ip):8080/manifest.webmanifest \
     | grep -qi 'content-type: *application/manifest+json' && echo "PASS" || echo "FAIL"
   ```
2. Verify every icon resolves:
   ```bash
   ICONS_OK=1
   for f in icon.svg icon-192.png icon-512.png icon-maskable-512.png apple-touch-icon.png; do
     code=$(curl -s -o /dev/null -w '%{http_code}' http://$(cat ~/.vm-ip):8080/$f)
     printf "%-24s %s\n" "$f" "$code"
     [ "$code" = "200" ] || ICONS_OK=0
   done
   [ "$ICONS_OK" = "1" ] && echo "Icons: PASS" || echo "Icons: FAIL"
   ```
3. Tell the user how to add it, on **iPhone/iPad**: open the portal URL in **Safari**
   (Chrome on iOS cannot install web apps), tap **Share**, then **Add to Home Screen**.
   On **Android**: open it in Chrome, then **Install app** or **Add to Home screen**.

**Verification:** Both blocks print PASS.

**Reaching it from a phone.** The portal listens on the VM's LAN address, so a phone can
only load it on the same network. If the user wants it from anywhere, put the VM on a private
network overlay such as [Tailscale](https://tailscale.com/) and use the VM's overlay hostname
in the URL before adding to the home screen. An installed web app keeps the URL it was
installed with, so pick the address that will still work later.

**Customising the icon.** Replace those files with your own artwork at the same names and
sizes, then reload. Keep `apple-touch-icon.png` opaque and keep `icon-maskable-512.png`
full-bleed to the edges. iOS caches aggressively: remove the home-screen icon and re-add it
to pick up a change.

---

### Phase 6: Extended Core Context

This is the most important phase. It teaches the AI assistant about the infrastructure that was just set up.

**Read the VM IP first:**
```bash
VM_IP=$(cat ~/.vm-ip)
```

You will need to replace `{VM_IP}` with the actual IP in the content below.

**Step 6a: Build the companion context file**

Read `~/pai-companion/companion/context/identity-additions.md` and `~/pai-companion/companion/context/steering-rules.md`, replace all `{VM_IP}` with the actual VM IP, and append both (infrastructure context first, then rules) to `~/.claude/PAI/USER/AISTEERINGRULES.md`. Create the file if it doesn't exist. Do NOT overwrite existing content — append with a clear separator:
```
---
<!-- Added by PAI Companion setup -->
```

On PAI v5, identity lives in `PRINCIPAL_IDENTITY.md` / `DA_IDENTITY.md`. Do not modify those files.

**Step 6b: Add the always-loaded summary to CLAUDE.md**

`AISTEERINGRULES.md` is not auto-loaded on PAI v5, so append this short block to the Operational Rules area of `~/.claude/CLAUDE.md` (replace `{VM_IP}` first):

```
- **Visual-first output.** For reports, dashboards, or anything styled, write HTML to `~/portal/{tag}/index.html` and surface the URL (http://{VM_IP}:8080/{tag}/). Prefer visual over terminal text dumps for anything the user will read or share. Apply the dark theme from `~/.claude/PAI/USER/DESIGN.md`.
- Companion repo full rules (with Bad/Correct examples): `~/.claude/PAI/USER/AISTEERINGRULES.md`. Always-loaded summary lives here in CLAUDE.md.
```

**Step 6c: Create design system file**

Copy `~/pai-companion/companion/context/design-system.md` to `~/.claude/PAI/USER/DESIGN.md`.

**Step 6d: Update settings.json contextFiles**

Ensure `~/.claude/settings.json` includes `USER/DESIGN.md` in the `contextFiles` array. Read the current settings.json, and if it is not already there, add it. Use `jq` or careful JSON editing. Do not break the existing settings. (PAI v5 ships this array empty; adding `USER/DESIGN.md` is exactly how the reference installs run.)

**Verification:**
- `grep -i "Visual-first" ~/.claude/PAI/USER/AISTEERINGRULES.md` should match
- `grep -i "Visual-first" ~/.claude/CLAUDE.md` should match
- `grep "VM_IP" ~/.claude/PAI/USER/AISTEERINGRULES.md ~/.claude/CLAUDE.md` should NOT match (placeholders replaced)
- `test -f ~/.claude/PAI/USER/DESIGN.md` should succeed
- `python3 -c "import json;print(json.load(open('$HOME/.claude/settings.json'))['contextFiles'])"` prints a list containing `USER/DESIGN.md`

---

### Phase 7: Document Creation Methodology

This was included in the design system file (Phase 6c). The methodology section in `DESIGN.md` teaches the assistant how to create styled HTML pages.

**Verification:** `grep "Document Creation" ~/.claude/PAI/USER/DESIGN.md` returns a match.

---

### Phase 8: Upstream Reference Repo (Pinned)

Set up a pinned upstream reference checkout. This is read-only reference material for the assistant, frozen at the same v5.0.0 the system runs. Do NOT pull latest here: upstream renamed to LifeOS and moved to newer major versions that this install is not tested against.

**Steps:**
1. Clone upstream at the pinned v5.0.0 tag (skip if `~/upstream/pai` already exists):
   ```bash
   git clone --branch v5.0.0 --depth 1 --filter=blob:none --sparse https://github.com/danielmiessler/LifeOS.git ~/upstream/pai
   cd ~/upstream/pai && git rev-parse HEAD
   ```
   The second command must print `12265edd740b56199a77b9d826fda27872bb04e9`. If it prints anything else, stop and tell the user the upstream tag moved.
   ```bash
   git sparse-checkout set Releases/v5.0.0
   ```

2. PAI v5.0.0 ships with its own Algorithm (`~/.claude/PAI/ALGORITHM/`). Leave it alone. Do not install Algorithm versions from other repos.

**Verification:**
- `git -C ~/upstream/pai rev-parse HEAD` prints `12265edd740b56199a77b9d826fda27872bb04e9`
- `ls ~/upstream/pai/Releases/v5.0.0/.claude` shows the release tree
- `cat ~/.claude/PAI/ALGORITHM/LATEST` still shows the version PAI 5 shipped (untouched)

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

### Phase 10b: Validate Timezone

PAI's time system requires IANA timezone IDs (e.g. `America/Los_Angeles`). Abbreviations like `PST` silently crash time-dependent hooks and the voice pipeline.

**Steps:**
1. Read the current timezone from `~/.claude/settings.json` (the `principal.timezone` field).
2. Test if it's a valid IANA timezone:
   ```bash
   TZ_VAL=$(jq -r '.principal.timezone // empty' ~/.claude/settings.json)
   bun -e "try { Intl.DateTimeFormat('en', { timeZone: '$TZ_VAL' }); console.log('valid'); } catch { console.log('invalid'); }"
   ```
3. If invalid (common abbreviations like PST, EST, CST, etc.), replace it with the correct IANA ID:
   - `PST` or `PDT` → `America/Los_Angeles`
   - `MST` or `MDT` → `America/Denver`
   - `CST` or `CDT` → `America/Chicago`
   - `EST` or `EDT` → `America/New_York`
   - If unsure, detect the system timezone via `timedatectl show -p Timezone --value` or `/etc/timezone`
   - Update `settings.json` with the correct IANA timezone using `jq`

**Verification:**
```bash
TZ_VAL=$(jq -r '.principal.timezone // empty' ~/.claude/settings.json)
bun -e "try { Intl.DateTimeFormat('en', { timeZone: '$TZ_VAL' }); console.log('PASS ($TZ_VAL)'); } catch { console.log('FAIL ($TZ_VAL)'); }"
```

---

### Phase 11: Welcome Experience and Final Verification

**Steps:**
1. Write the companion version marker:
   ```bash
   echo "companion-$(date +%Y%m%d)" > ~/portal/.companion-version
   echo "Version marker: $(cat ~/portal/.companion-version)"
   ```

2. Verify the welcome page is accessible. A minimal install does not have one, so skip
   rather than fail:
   ```bash
   test -d ~/portal/welcome \
     && curl -f http://$(cat ~/.vm-ip):8080/welcome/ \
     || echo "SKIP (minimal install has no welcome page)"
   ```

3. Run the full verification checklist:

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
grep -qi "Visual-first" ~/.claude/PAI/USER/AISTEERINGRULES.md 2>/dev/null && echo "PASS" || echo "FAIL"

echo -n "Design system installed: "
test -f ~/.claude/PAI/USER/DESIGN.md && echo "PASS" || echo "FAIL"

# Phase 6 writes steering rules, not identity: v5 keeps identity in PRINCIPAL_IDENTITY.md /
# DA_IDENTITY.md and Step 6a explicitly leaves those alone. The old IDENTITY.md check here
# could only ever print FAIL.
echo -n "Portal known to the assistant: "
grep -q "portal" ~/.claude/CLAUDE.md 2>/dev/null && echo "PASS" || echo "FAIL"

# Phase 7
echo -n "Design methodology: "
grep -q "Document Creation" ~/.claude/PAI/USER/DESIGN.md 2>/dev/null && echo "PASS" || echo "FAIL"

# Phase 8
echo -n "Upstream PAI: "
if [ ! -d ~/upstream/pai ]; then echo "SKIP (Phase 8 not run)"; else
git -C ~/upstream/pai log --oneline -1 >/dev/null 2>&1 && echo "PASS" || echo "FAIL"; fi

# (No check for ~/upstream/TheAlgorithm: no phase clones it, and PAI v5 ships its own
# Algorithm. A check for something the guide never installs can only print FAIL.)

echo -n "Algorithm installed: "
ALG=""
for f in ~/.claude/PAI/ALGORITHM/LATEST ~/.claude/PAI/Algorithm/LATEST; do
  [ -s "$f" ] && { ALG=$(cat "$f"); break; }
done
[ -n "$ALG" ] && echo "PASS ($ALG)" || echo "FAIL"

# Phase 9
echo -n "Git tracking (.claude): "
git -C ~/.claude log --oneline -1 >/dev/null 2>&1 && echo "PASS" || echo "FAIL"

echo -n "Git tracking (work): "
git -C ~/work log --oneline -1 >/dev/null 2>&1 && echo "PASS" || echo "FAIL"

# Phase 10
echo -n "Cron jobs: "
crontab -l 2>/dev/null | grep -q "daily snapshot" && echo "PASS" || echo "FAIL"

# Phase 10b
echo -n "Timezone valid: "
TZ_VAL=$(jq -r '.principal.timezone // empty' ~/.claude/settings.json 2>/dev/null)
if [ -n "$TZ_VAL" ]; then
  bun -e "try { Intl.DateTimeFormat('en', { timeZone: '$TZ_VAL' }); console.log('PASS ($TZ_VAL)'); } catch { console.log('FAIL ($TZ_VAL)'); }" 2>/dev/null || echo "SKIP"
else
  echo "SKIP (no timezone set)"
fi

# Phase 11
echo -n "Welcome page: "
if [ ! -d ~/portal/welcome ]; then echo "SKIP (minimal install)"; else
curl -sf http://$(cat ~/.vm-ip):8080/welcome/ >/dev/null 2>&1 && echo "PASS" || echo "FAIL"; fi

# Version marker
echo -n "Version marker: "
test -f ~/portal/.companion-version && echo "PASS ($(cat ~/portal/.companion-version))" || echo "FAIL"

# Safety checks
echo ""
echo "=== Safety Checks ==="
echo -n "No localhost in steering rules: "
grep -q "http://localhost" ~/.claude/PAI/USER/AISTEERINGRULES.md 2>/dev/null && echo "FAIL (found localhost URL, should be the VM IP)" || echo "PASS"

echo -n "Docker container running: "
docker ps 2>/dev/null | grep -q "portal" && echo "PASS" || echo "FAIL"

echo ""
echo "=== Verification Complete ==="
```

4. Report results to the user in plain language. Show the portal URL and exchange URL prominently.

**Tell the user:**
> Setup is complete! Here's what you have:
>
> - **Portal:** http://<VM_IP>:8080/ (your AI-created web pages appear here)
> - **Exchange:** http://<VM_IP>:8080/exchange/ (drag and drop files here)
> - **Clipboard:** http://<VM_IP>:8080/clipboard/ (copyable text from your assistant)
> - **Welcome guide:** http://<VM_IP>:8080/welcome/ (getting started prompts) — omit this line if you took the minimal path, which has no welcome page
>
> Open any of these URLs in your browser on your host machine. Try asking me to create something for you!
