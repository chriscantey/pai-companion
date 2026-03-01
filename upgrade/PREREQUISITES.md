# Prerequisites for PAI Upgrade

Before upgrading, verify these requirements are met.

## Required

- **PAI v3** currently installed in `~/.claude/`
- **Claude Code** installed and authenticated
- **Bun** runtime installed
- **Git** installed
- **Disk space:** At least 500MB free (for backup + new files)

## Recommended

- **No active Claude Code sessions** during upgrade
- **Recent git commit** of your `~/.claude/` directory (the upgrade will create one if needed)

## How to Check Your Version

```bash
# v4+ has this file:
cat ~/.claude/PAI/Algorithm/LATEST 2>/dev/null

# v3 has flat skills directory (no subdirectories in skills/):
ls ~/.claude/skills/ | head -5

# v3 does NOT have a PAI/ directory at the root:
test -d ~/.claude/PAI && echo "v4+" || echo "v3 or earlier"
```

## What You Need Access To

The upgrade reads from the upstream PAI release files. Your AI assistant will need access to either:

1. **Local clone:** `~/upstream/pai/` (if you have it)
2. **GitHub raw URL:** The upgrade will fetch what it needs from the PAI releases

## PAI Companion Users

If you have PAI Companion installed (portal server, voice, custom context), the upgrade preserves your companion additions. The upgrade detects companion components and handles them separately from upstream PAI files.
