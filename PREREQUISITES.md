# Prerequisites (Pre-Install Checklist)

This documents what should be installed in the VM **before** running the companion setup.

The companion setup (`README.md`) assumes these are already present. If anything is missing, the setup will fail or degrade.

## Core Tools

These are installed during the initial system setup:

```bash
sudo apt update && sudo apt install -y curl git zip unzip
```

## Bun Runtime

```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
```

## Claude Code

Follow Anthropic's official install instructions for Claude Code.

## PAI v2.5

Installed via the PAI install wizard. See [danielmiessler/PAI](https://github.com/danielmiessler/PAI).

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
```

## Playwright Dependencies (Optional)

Optional but recommended. Enables the Browser skill (web page screenshots and automation). You can always install this later if you skip it now.

System libraries required by Chromium:
```bash
sudo apt install -y \
  libnss3 libatk1.0-0t64 libatk-bridge2.0-0t64 \
  libcups2t64 libdrm2 libxkbcommon0 libxcomposite1 \
  libxdamage1 libxrandr2 libgbm1 libpango-1.0-0 \
  libcairo2 libasound2t64 libxshmfence1
```

Then install Chromium for Playwright (as normal user, no sudo):
```bash
bunx playwright install chromium
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
docker run --rm hello-world

# Playwright (optional)
ls ~/.cache/ms-playwright/chromium-*/chrome-linux*/chrome 2>/dev/null && echo "Playwright: OK" || echo "Playwright: not installed (optional)"

# PAI v2.5 installed
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
