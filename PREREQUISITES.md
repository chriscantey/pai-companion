# Prerequisites (Pre-Install Checklist)

This documents what should be installed in the VM **before** running the companion setup.

The companion setup (`README.md`) assumes these are already present. If anything is missing, the setup will fail or degrade.

## Core Tools, Bun, Claude Code, and PAI v3.0

We have a full walkthrough covering everything from a fresh Ubuntu VM through a working PAI installation:

- **Blog post:** [Setting Up Your Personal AI Assistant](https://chriscantey.com/posts/2026-02-02-setting-up-your-personal-ai-assistant/)
- **Video:** [Watch on YouTube](https://www.youtube.com/watch?v=ZZ6B06GfD-w)

If you prefer direct instructions, here's the short version:

```bash
# Core tools
sudo apt update && sudo apt install -y curl git zip unzip

# Bun runtime
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc

# Claude Code - follow Anthropic's official install instructions

# PAI v3.0 - install via the PAI wizard
# See: https://github.com/danielmiessler/PAI
```

## Docker

Required for the portal server:

```bash
sudo apt install -y docker.io docker-compose-v2
sudo usermod -aG docker $USER
```

**Important:** Log out and back in (or reboot) after adding to docker group.

Verify Docker works without sudo:
```bash
docker run --rm hello-world
docker rmi hello-world
```

## Playwright Dependencies (Optional)

Optional but recommended. Enables the Browser skill (web page screenshots and automation). You can always install this later if you skip it now.

### Method 1: Standard Install

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

### Method 2: Manual Download (if Method 1 hangs)

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

### Verify

Whichever method you used, confirm Playwright can actually take a screenshot:

```bash
cd ~/.claude/skills/Browser && bun run node_modules/.bin/playwright screenshot \
  --browser chromium https://example.com /tmp/playwright-test.png \
  && echo "Playwright: fully working" \
  || echo "Playwright: installed but not functional - check deps"
```

## Useful CLI Tools

These are optional but recommended. The AI assistant will use them if available:

```bash
sudo apt install -y \
  jq tree tmux wget whois dnsutils \
  imagemagick ffmpeg python3-venv
```

## Verification

Run these to confirm everything is installed correctly:

```bash
# Core tools
which git curl bun claude

# Docker (without sudo)
docker run --rm hello-world && docker rmi hello-world

# Playwright (optional) - functional test, not just binary check
cd ~/.claude/skills/Browser && bun run node_modules/.bin/playwright screenshot \
  --browser chromium https://example.com /tmp/playwright-test.png 2>/dev/null \
  && echo "Playwright: OK" \
  || echo "Playwright: not installed or not functional (optional)"

# PAI v3.0 installed
cat ~/.claude/skills/PAI/SKILL.md | head -5

# Claude Code authenticated
claude --version
```

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
