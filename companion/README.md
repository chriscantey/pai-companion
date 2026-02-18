# PAI Companion: Core

The foundation package that adds visual output, file sharing, and system management to PAI.

Blog post: [PAI Companion: A Visual Jumpstart for Your AI Assistant](https://chriscantey.com/posts/2026-02-14-pai-companion/)

## What's Included

- **Portal server** for viewing AI-created web pages, dashboards, and reports
- **File exchange** with drag-and-drop browser UI
- **Clipboard page** for easy copy of AI-generated text
- **Skills browser** for exploring installed PAI skills interactively
- **Agents browser** for viewing available agent types and personalities
- **System overview** dashboard showing PAI installation status
- **Welcome page** with getting-started prompts and examples
- **Dark theme design system** (Nightfall) for consistent styled output
- **Directory conventions** for organized file management
- **Linux adaptation patches** for cross-platform PAI compatibility
- **Upstream repo tracking** and automated maintenance

## Architecture

```
PAI (Claude Code)
  |
  |-- portal output --> Portal Server (:8080)
  |                          |
  |                    +-----+------+-----+
  |                    |     |      |     |
  |                  Pages  Exchange Clipboard  Welcome
```

| Component | Port | Purpose |
|-----------|------|---------|
| Portal server | 8080 | Web content, file exchange, clipboard |

## Setup

Tell your AI assistant:

> Read https://raw.githubusercontent.com/chriscantey/pai-companion/main/companion/INSTALL.md and follow the setup phases.

Or if the repo is already cloned:

> Read ~/pai-companion/companion/INSTALL.md and follow the setup phases.

Prerequisites: [PREREQUISITES.md](PREREQUISITES.md)

## File Reference

| Path | Purpose |
|------|---------|
| `INSTALL.md` | Setup instructions (for AI assistants) |
| `PREREQUISITES.md` | System requirements |
| `portal/` | Portal server source and static files |
| `context/` | Context files appended during setup |
| `patches/` | Cross-platform compatibility patches |
| `scripts/` | Setup and maintenance scripts |
| `welcome/` | Getting-started guide |
