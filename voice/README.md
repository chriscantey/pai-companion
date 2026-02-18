# PAI Voice Module

Local text-to-speech voice notifications for PAI using [Kokoro TTS](https://github.com/hexgrad/kokoro).

Your AI assistant speaks to you: phase announcements, task completions, alerts. Audio streams to any browser via WebSocket. No cloud APIs, no GPU required, fully local and free.

Blog post: [Your AI Assistant Can Talk](https://chriscantey.com/posts/2026-02-18-your-ai-assistant-can-talk/)

## How It Works

```
Claude Code hooks --> POST /notify --> Voice Server (Bun, :8888)
                                            |
                                       Kokoro TTS (:7880)
                                            |
                                       WebSocket broadcast
                                            |
                                    +-------+-------+
                                    |               |
                              Web Client      Portal Widget
                           (standalone)    (in companion portal)
```

1. PAI's existing hooks call `POST /notify` with a message (same API as upstream)
2. The voice server sends the text to the Kokoro TTS sidecar
3. Kokoro generates speech locally (82M params, CPU-only, ~1-3 seconds)
4. Audio is broadcast to all connected WebSocket clients
5. Your browser plays the audio

## Components

| Component | Technology | Lines | Purpose |
|-----------|-----------|-------|---------|
| Voice server | Bun/TypeScript | ~370 | HTTP API + WebSocket streaming |
| Kokoro sidecar | Python | ~180 | Local TTS generation with NaN recovery |
| Web client | HTML/JS | ~380 | Standalone audio player page |
| Voice widget | JS | ~285 | Floating player for portal integration |
| Voice preview | HTML/JS | ~520 | Listen to and choose voices |

## Kokoro TTS

[Kokoro](https://github.com/hexgrad/kokoro) is an 82-million parameter open-source text-to-speech model:

- **Apache 2.0** license (fully free for personal and commercial use)
- **CPU-only** (no GPU required, runs anywhere Docker runs)
- **67 voices** across 9 languages (American, British, Spanish, French, Hindi, Italian, Japanese, Portuguese, Chinese)
- **Top-ranked open-source model on TTS Arena** with 7.6M monthly HuggingFace downloads

## Drop-In Replacement

This voice server is a drop-in replacement for upstream PAI's voice server:

- Same URL: `http://localhost:8888`
- Same API: `POST /notify` with `{ message, title, voice_enabled, voice_name }`
- All existing PAI hooks work without modification
- You do NOT need to rebuild phase.ts, hooks, or any PAI integration

The only difference: upstream uses ElevenLabs (paid API, macOS-only playback). This uses Kokoro (free, local, streams to any browser).

## Setup

Tell your AI assistant:

> Read https://raw.githubusercontent.com/chriscantey/pai-companion/main/voice/INSTALL.md and follow the setup phases.

Or if the repo is already cloned:

> Read ~/pai-companion/voice/INSTALL.md and follow the setup phases.
