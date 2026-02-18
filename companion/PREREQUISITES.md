# Prerequisites

What to install before running the companion setup. The companion setup (`README.md`) assumes everything in the **Required** section is present.

We have a full walkthrough covering everything from a fresh VM through a working PAI installation:

- **Blog post:** [Setting Up Your Personal AI Assistant](https://chriscantey.com/posts/2026-02-02-setting-up-your-personal-ai-assistant/)
- **Video:** [Watch on YouTube](https://www.youtube.com/watch?v=ZZ6B06GfD-w)

If you prefer direct instructions, follow the steps below.

---

## Required

These five steps get you from a fresh Debian or Ubuntu VM to ready for the companion setup. Run everything as a regular user, not root. Commands that need elevated privileges already use `sudo`.

> **Why not let the assistant do this?** We don't give Claude Code sudo access. That's intentional. These prerequisites require elevated privileges, so you run them yourself. Once the setup is done, the companion phases don't need sudo at all.

> **Need a non-root user?** Ubuntu creates one during installation. Some distros (like Debian) default to root only. If you need to create a regular user with sudo access, [this guide](https://www.digitalocean.com/community/tutorials/how-to-create-a-new-sudo-enabled-user-on-ubuntu) covers the steps (works on Debian too).

### Step 1: System packages

```bash
sudo apt update && sudo apt install -y curl git zip
```

### Step 2: Bun runtime

```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
```

### Step 3: Claude Code

```bash
curl -fsSL https://claude.ai/install.sh | bash
```

After installing, run `claude` once to authenticate with your Anthropic API key.

### Step 4: Docker

This should work on most Linux distros. It installs Docker Engine and the Compose v2 plugin in one step.

```bash
curl -fsSL https://get.docker.com | bash
sudo usermod -aG docker $USER
```

**Important:** Log out and back in (or reboot) after adding yourself to the docker group. The next step won't work until you do.

### Step 5: PAI v3.0

```bash
git clone https://github.com/danielmiessler/PAI.git
cp -r PAI/Releases/v3.0/.claude ~/
cd ~/.claude && bash install.sh
```

### Verify

After logging back in (for docker group), confirm everything is working:

```bash
which git curl bun claude
docker run --rm hello-world && docker rmi hello-world
docker compose version
claude --version
cat ~/.claude/skills/PAI/SKILL.md | head -5
```

All commands should succeed. If any fail, revisit the corresponding step above.

---

## Recommended

These are optional. You can always install them later.

### Useful CLI tools

The AI assistant will use these if available. None are required, but they make the assistant more capable:

```bash
sudo apt install -y jq tree tmux wget whois dnsutils imagemagick ffmpeg python3-venv
```

### Playwright (Browser skill)

Enables the Browser skill for web page screenshots and automation. Not required for the companion setup itself, but useful once your assistant is running.

#### Method 1: Standard install

```bash
# Install the playwright package in the Browser skill
cd ~/.claude/skills/Browser && bun install

# Install system libraries that Chromium needs
# (sudo can't find bun since it's installed per-user, so we pass PATH through)
sudo env "PATH=$PATH" bunx playwright install-deps chromium

# Download Chromium browsers
cd ~/.claude/skills/Browser && bun run node_modules/.bin/playwright install chromium
```

**Note:** The download shows "100%" after the first component, then downloads a second with no progress bar. Let it sit for up to 5 minutes. If it's still stuck after that, Ctrl+C and use Method 2.

#### Method 2: Manual download (if Method 1 hangs)

We've seen the automated installer hang on some systems, particularly ARM64 Linux VMs (e.g., UTM/Parallels on Mac). If Method 1 doesn't complete, this approach downloads the same files directly:

```bash
# Install the playwright package (if not already done)
cd ~/.claude/skills/Browser && bun install

# Install system libraries (if not already done)
sudo env "PATH=$PATH" bunx playwright install-deps chromium

# Detect the playwright build version and architecture
cd ~/.claude/skills/Browser
PWVER=$(bun -e "console.log(require('playwright-core/browsers.json').browsers.find(b=>b.name==='chromium').revision)")
ARCH=$(uname -m | sed 's/x86_64/linux/;s/aarch64/linux-arm64/')

# Download both browser components
curl -L -o /tmp/chromium.zip \
  "https://cdn.playwright.dev/dbazure/download/playwright/builds/chromium/${PWVER}/chromium-${ARCH}.zip"
curl -L -o /tmp/headless-shell.zip \
  "https://cdn.playwright.dev/dbazure/download/playwright/builds/chromium/${PWVER}/chromium-headless-shell-${ARCH}.zip"

# Extract to where Playwright expects them
mkdir -p ~/.cache/ms-playwright/chromium-${PWVER}
unzip /tmp/chromium.zip -d ~/.cache/ms-playwright/chromium-${PWVER}/
mkdir -p ~/.cache/ms-playwright/chromium_headless_shell-${PWVER}
unzip /tmp/headless-shell.zip -d ~/.cache/ms-playwright/chromium_headless_shell-${PWVER}/

# Clean up
rm /tmp/chromium.zip /tmp/headless-shell.zip
```

#### Verify Playwright

```bash
cd ~/.claude/skills/Browser && bun run node_modules/.bin/playwright screenshot \
  --browser chromium https://example.com /tmp/playwright-test.png \
  && echo "Playwright: fully working" \
  || echo "Playwright: installed but not functional - check deps"
```

---

## What the Companion Setup Handles

The companion setup (README.md phases) handles everything else:

- Linux statusline compatibility fix
- IP detection and URL configuration
- Directory structure creation
- Portal server deployment (Docker)
- Core context additions (steering rules, design system, identity)
- Latest Algorithm installation from upstream
- Upstream repo cloning
- Git initialization
- Cron job installation
- Welcome page

None of these require sudo. The companion setup assumes Docker is already working.
