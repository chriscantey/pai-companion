# PAI Companion

> **Work in Progress.** This is an evolving onboarding package for PAI (Personal AI Infrastructure). It is not production-ready. Expect rough edges, missing pieces, and changes.

A companion package for [PAI v3.0](https://github.com/danielmiessler/PAI) that adds visual output, file sharing, and voice notifications to your AI assistant. Designed for users running PAI on a local Linux VM (Debian, Ubuntu, or similar).

## What's Included

### Core (Portal + Exchange)

The foundation that every PAI Companion user gets:

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

Setup instructions: [companion/INSTALL.md](companion/INSTALL.md)

### Voice Module (Optional)

Local text-to-speech voice notifications powered by [Kokoro TTS](https://github.com/hexgrad/kokoro) (82M params, Apache 2.0, runs on CPU).

Your AI assistant speaks to you: phase announcements, task completions, alerts. Audio streams to any browser via WebSocket. No cloud APIs, no GPU required, fully local.

- **Voice server** (Bun/TypeScript) that accepts POST /notify and streams audio via WebSocket
- **Kokoro TTS sidecar** (Python) that generates speech locally
- **Web audio player** that plays notifications in your browser (standalone or integrated into the portal)
- **Voice preview page** to listen to and choose from 67 voices across 9 languages
- **Drop-in replacement** for upstream PAI's voice server (same localhost:8888, same /notify API)

Setup instructions: [voice/INSTALL.md](voice/INSTALL.md)

## Architecture

```
PAI (Claude Code)
  |
  |-- hooks/phase.ts --> POST /notify --> Voice Server (:8888)
  |                                           |
  |                                     Kokoro TTS (:7880)
  |                                           |
  |                                     WebSocket broadcast
  |                                           |
  |                                  +--------+--------+
  |                                  |                  |
  |                            Web Client         Portal Widget
  |                          (standalone)      (embedded in portal)
  |
  |-- portal output --> Portal Server (:8080)
  |                          |
  |                    +-----+------+-----+
  |                    |     |      |     |
  |                  Pages  Exchange Clipboard  Welcome
```

## Quick Reference

| Component | Port | Purpose |
|-----------|------|---------|
| Portal server | 8080 | Web content, file exchange, clipboard |
| Voice server | 8888 | Voice notifications (HTTP + WS) |
| Voice server (WSS) | 8889 | Remote voice streaming (TLS, optional) |
| Kokoro TTS | 7880 | Local speech generation (internal) |

## File Reference

| Path | Purpose |
|------|---------|
| `companion/INSTALL.md` | Core setup instructions (for AI assistants) |
| `companion/PREREQUISITES.md` | System requirements |
| `companion/portal/` | Portal server source and static files |
| `companion/context/` | Context files appended during setup |
| `companion/patches/` | Cross-platform compatibility patches |
| `companion/scripts/` | Setup and maintenance scripts |
| `companion/welcome/` | Getting-started guide |
| `voice/` | Voice module (optional) |
| `voice/INSTALL.md` | Voice setup instructions (for AI assistants) |
| `voice/docker-compose.yml` | Voice server + Kokoro Docker config |
| `voice/server/` | Voice server source (Bun/TypeScript) |
| `voice/kokoro/` | Kokoro TTS sidecar + base image build script |
| `voice/web-client/` | Browser audio player and voice preview |

## What This Does NOT Include

- HTTPS certificates (HTTP should be fine for a local network VM)
- Remote git repos or cloud services
- GPU or paid API keys (Kokoro runs on CPU)

## Links

- [PAI Companion setup guide](https://chriscantey.com/posts/2026-02-14-pai-companion/) (blog post with context and walkthrough)
- [PAI (upstream)](https://github.com/danielmiessler/PAI)
- [The Algorithm](https://github.com/danielmiessler/TheAlgorithm)
- [Kokoro TTS](https://github.com/hexgrad/kokoro)
