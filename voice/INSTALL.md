# PAI Voice Module: Setup Instructions

> **For AI Assistants.** Follow these phases to set up voice notifications. Each phase is independently verifiable. If interrupted, resume from any phase.

**Prerequisites:**
- PAI Companion core setup completed ([../companion/INSTALL.md](../companion/INSTALL.md))
- Docker installed and working without sudo
- Docker network `pai-network` exists (created during portal setup, or run `docker network create pai-network`)
- Internet connection (for building the Kokoro base image)
- ~15GB free disk space during build (settles to ~5GB after cleanup)
- 8GB RAM minimum (16GB recommended)

---

### Phase 1: Build Kokoro Base Image

The Kokoro TTS model runs inside a Docker container. This phase builds the base image with the model weights (~330MB) and all dependencies.

**Steps:**
1. Navigate to the voice module:
   ```bash
   cd ~/pai-companion/voice
   ```
2. Run the base image build script:
   ```bash
   bash kokoro/build-base-image.sh
   ```
   This takes 5-15 minutes on first run. It downloads model weights from HuggingFace and installs PyTorch (CPU version).

**Verification:**
```bash
docker image inspect kokoro-tts-cpu:local >/dev/null 2>&1 && echo "PASS" || echo "FAIL"
```

---

### Phase 2: Create Docker Network

Ensure the shared Docker network exists for container communication.

**Steps:**
1. Create the network (safe to run if it already exists):
   ```bash
   docker network create pai-network 2>/dev/null || true
   ```

**Verification:**
```bash
docker network inspect pai-network >/dev/null 2>&1 && echo "PASS" || echo "FAIL"
```

---

### Phase 3: Start Voice Server

Launch the voice server and Kokoro TTS sidecar.

**Steps:**
1. Build and start the containers:
   ```bash
   cd ~/pai-companion/voice && docker compose up -d --build
   ```
2. Wait for Kokoro to warm up (first pipeline load takes ~30 seconds):
   ```bash
   sleep 10
   docker logs voice-server-kokoro 2>&1 | tail -5
   ```
   Look for "Kokoro TTS server ready on port 7880" in the output.

**Verification:**
```bash
# Voice server health
curl -sf http://localhost:8888/health | python3 -c "import sys,json; d=json.load(sys.stdin); print('PASS' if d['status']=='ok' else 'FAIL')"

# Kokoro sidecar health (no curl in container, check logs instead)
docker logs voice-server-kokoro 2>&1 | grep -q "ready on port 7880" && echo "PASS" || echo "FAIL (check: docker logs voice-server-kokoro)"
```

---

### Phase 4: Test Voice Generation

Generate a test notification to verify end-to-end TTS works.

**Steps:**
1. Send a test notification:
   ```bash
   curl -s -X POST http://localhost:8888/notify \
     -H "Content-Type: application/json" \
     -d '{"message": "Voice server is working. Hello from PAI!"}' | python3 -c "import sys,json; d=json.load(sys.stdin); print(d['status'])"
   ```
   Expected output: `success`

2. Test direct TTS generation:
   ```bash
   curl -s -X POST http://localhost:8888/tts \
     -H "Content-Type: application/json" \
     -d '{"text": "Testing", "voice": "af_heart"}' \
     -o /tmp/test-voice.mp3 && echo "PASS ($(wc -c < /tmp/test-voice.mp3) bytes)" || echo "FAIL"
   ```

**Verification:** Both commands succeed. The notify returns "success". The TTS generates an MP3 file larger than 1000 bytes.

---

### Phase 5: Deploy Web Audio Client

Set up the browser-based audio player so you can hear notifications.

**Option A: Standalone (no PAI Companion portal)**

Copy the web client files to a location served by any web server, or open `web-client/index.html` directly in a browser. The standalone player connects to the voice server WebSocket and plays audio.

```bash
# If you have the portal server, copy to a portal subdirectory:
cp -r ~/pai-companion/voice/web-client ~/portal/voice
echo "PASS: Voice client at http://$(cat ~/.vm-ip 2>/dev/null || echo localhost):8080/voice/"
```

**Option B: Integrated into PAI Companion portal**

Add the floating voice widget to the portal homepage so voice plays in the background:

1. Copy the widget script:
   ```bash
   mkdir -p ~/portal/voice
   cp ~/pai-companion/voice/web-client/voice-widget.js ~/portal/voice/voice-widget.js
   cp ~/pai-companion/voice/web-client/voices.html ~/portal/voice/voices.html
   cp ~/pai-companion/voice/web-client/index.html ~/portal/voice/index.html
   ```

2. Add the widget to the portal homepage. Add this line before `</body>` in `~/portal/index.html`:
   ```html
   <script src="/voice/voice-widget.js"></script>
   ```

The widget appears as a small floating pill in the bottom-right corner showing connection status and a mute toggle.

**Verification:**
```bash
# Check files are in place
test -f ~/portal/voice/index.html && echo "PASS" || echo "FAIL"
test -f ~/portal/voice/voice-widget.js && echo "PASS" || echo "FAIL"
```

---

### Phase 6: Choose a Voice (Optional)

Browse and preview available voices.

**Steps:**
1. Open the voice preview page in your browser:
   ```
   http://<VM_IP>:8080/voice/voices.html
   ```
   (Or open `~/pai-companion/voice/web-client/voices.html` directly)

2. Click any voice card to hear a preview. The page shows curated English voices by default with an option to show all 67 voices.

3. Once you choose a voice, set it as default by adding to `~/.claude/.env`:
   ```
   KOKORO_VOICE=af_heart
   ```
   Replace `af_heart` with your chosen voice ID (shown on the preview page).

4. Restart the voice server to apply:
   ```bash
   cd ~/pai-companion/voice && docker compose restart voice-server
   ```

**Verification:**
```bash
curl -sf http://localhost:8888/health | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'Default voice: {d[\"default_voice\"]}')"
```

---

### Phase 7: Upgrade Protection

Prevent PAI updates from overwriting the voice server.

When PAI updates, the upstream VoiceServer skill may try to install its own voice server on the same port. To prevent conflicts:

1. Disable the upstream VoiceServer skill if it exists:
   ```bash
   # Check if upstream VoiceServer exists
   if [ -d ~/.claude/skills/VoiceServer ]; then
     # Rename to prevent loading
     mv ~/.claude/skills/VoiceServer ~/.claude/skills/VoiceServer.disabled
     echo "Upstream VoiceServer disabled"
   else
     echo "No upstream VoiceServer found (OK)"
   fi
   ```

2. After any PAI update, check if VoiceServer was re-added:
   ```bash
   test -d ~/.claude/skills/VoiceServer && echo "WARNING: Upstream VoiceServer restored by update, disable it again" || echo "OK"
   ```

**Verification:**
```bash
test -d ~/.claude/skills/VoiceServer && echo "FAIL (upstream VoiceServer active)" || echo "PASS"
```

---

### Phase 8: PAI Hook Patches

PAI's default hooks were designed for cloud TTS (ElevenLabs). Local Kokoro TTS needs two adjustments:

**Step 8a: Fix voice notification timeout**

The default 3-second timeout in `~/.claude/hooks/handlers/VoiceNotification.ts` is too short for local TTS synthesis. Find the `setTimeout(() => controller.abort(), 3000)` line and change `3000` to `15000`. If the timeout is already >= 15000, no change is needed.

**Step 8b: Validate timezone** (prevents silent crashes)

PAI's time system requires IANA timezone IDs (e.g. `America/Los_Angeles`). Abbreviations like `PST` silently crash the voice pipeline and time-dependent hooks.

1. Read `principal.timezone` from `~/.claude/settings.json`
2. Test if valid: `bun -e "try { Intl.DateTimeFormat('en', { timeZone: 'THE_VALUE' }); console.log('valid'); } catch { console.log('invalid'); }"`
3. If invalid, replace the abbreviation with the correct IANA ID (PST/PDT → `America/Los_Angeles`, EST/EDT → `America/New_York`, CST/CDT → `America/Chicago`, MST/MDT → `America/Denver`). If unsure, detect via `timedatectl show -p Timezone --value` or `/etc/timezone`. Update `settings.json` with `jq`.

**Verification:**
```bash
# Timeout patched
echo -n "Voice timeout: "
grep -oP 'setTimeout\(\(\) => controller\.abort\(\), \K[0-9]+' ~/.claude/hooks/handlers/VoiceNotification.ts 2>/dev/null | awk '{print ($1 >= 15000) ? "PASS ("$1"ms)" : "FAIL ("$1"ms - too short)"}'

# Timezone valid
echo -n "Timezone: "
TZ_VAL=$(jq -r '.principal.timezone // empty' ~/.claude/settings.json 2>/dev/null)
if [ -n "$TZ_VAL" ]; then
  bun -e "try { Intl.DateTimeFormat('en', { timeZone: '$TZ_VAL' }); console.log('PASS ($TZ_VAL)'); } catch { console.log('FAIL ($TZ_VAL is not a valid IANA timezone)'); }" 2>/dev/null || echo "FAIL (could not validate)"
else
  echo "SKIP (no timezone set)"
fi
```

---

### Final Verification

Run the full voice module check:

```bash
echo "=== PAI Voice Module Verification ==="
echo ""

echo -n "Kokoro base image: "
docker image inspect kokoro-tts-cpu:local >/dev/null 2>&1 && echo "PASS" || echo "FAIL"

echo -n "Docker network: "
docker network inspect pai-network >/dev/null 2>&1 && echo "PASS" || echo "FAIL"

echo -n "Voice server running: "
curl -sf http://localhost:8888/health >/dev/null 2>&1 && echo "PASS" || echo "FAIL"

echo -n "Kokoro sidecar running: "
docker ps | grep -q voice-server-kokoro && echo "PASS" || echo "FAIL"

echo -n "TTS generation works: "
curl -s -X POST http://localhost:8888/notify -H "Content-Type: application/json" -d '{"message":"test","voice_enabled":true}' 2>/dev/null | grep -q '"success"' && echo "PASS" || echo "FAIL"

echo -n "Web client deployed: "
test -f ~/portal/voice/index.html 2>/dev/null && echo "PASS" || echo "SKIP (standalone mode)"

echo -n "Upstream VoiceServer disabled: "
test -d ~/.claude/skills/VoiceServer && echo "FAIL (disable it)" || echo "PASS"

echo -n "Voice timeout patched: "
TIMEOUT=$(grep -oP 'setTimeout\(\(\) => controller\.abort\(\), \K[0-9]+' ~/.claude/hooks/handlers/VoiceNotification.ts 2>/dev/null || echo "0")
[ "$TIMEOUT" -ge 15000 ] 2>/dev/null && echo "PASS (${TIMEOUT}ms)" || echo "FAIL (${TIMEOUT}ms)"

echo -n "Timezone valid: "
TZ_VAL=$(jq -r '.principal.timezone // empty' ~/.claude/settings.json 2>/dev/null)
if [ -n "$TZ_VAL" ]; then
  bun -e "try { Intl.DateTimeFormat('en', { timeZone: '$TZ_VAL' }); console.log('PASS ($TZ_VAL)'); } catch { console.log('FAIL ($TZ_VAL)'); }" 2>/dev/null || echo "SKIP"
else
  echo "SKIP (no timezone set)"
fi

echo ""
echo "=== Voice Module Verification Complete ==="
```

**Tell the user:**
> Voice is set up! Here's what you have:
>
> - **Voice player:** http://<VM_IP>:8080/voice/ (open this to hear notifications)
> - **Voice preview:** http://<VM_IP>:8080/voice/voices.html (choose your voice)
> - **Voice server:** http://localhost:8888 (your assistant talks through this)
>
> Keep the voice player tab open in your browser. When your assistant completes tasks or announces phases, you'll hear it speak.
