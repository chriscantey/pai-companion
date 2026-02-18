# PAI Companion

> **Work in Progress.** This is an evolving onboarding package for [PAI](https://github.com/danielmiessler/PAI) (Personal AI Infrastructure). Expect rough edges, missing pieces, and changes.

PAI Companion adds a web portal, file exchange, and optional voice notifications to your PAI-powered AI assistant. It's designed for users running PAI on a local Linux VM (Debian, Ubuntu, or similar).

## Core: Portal + Exchange

The foundation package. Gives your assistant a portal for displaying web pages, dashboards, and reports, a file exchange for sharing files between your machine and the VM, a clipboard page, and a dark theme design system for all visual output.

The blog post covers what PAI Companion is, what it does, and walks you through getting it running:

- **Blog post:** [PAI Companion: A Visual Jumpstart for Your AI Assistant](https://chriscantey.com/posts/2026-02-14-pai-companion/)
- **README:** [What's included and how it works](companion/)

Or if you prefer, jump straight in:

### Quick Start

Make sure you've met the [prerequisites](companion/PREREQUISITES.md) first, then tell your AI assistant:

> Read https://raw.githubusercontent.com/chriscantey/pai-companion/main/companion/INSTALL.md and follow the setup phases.

Your assistant will walk through each phase of the setup. If anything breaks or gets interrupted, it can pick up from where it left off. The `INSTALL.md` files in this repo are step-by-step guides written for AI assistants to follow, so you don't need to read them yourself unless you're curious.

---

## Optional: Voice Module

Once the core is set up, you can add local text-to-speech so your assistant can speak to you. Phase announcements, task completions, alerts. Audio streams to any browser on your network. Powered by [Kokoro TTS](https://github.com/hexgrad/kokoro), an open-source model that runs on CPU. No cloud APIs, no GPU, fully local and free.

- **Blog post:** [Your AI Assistant Can Talk](https://chriscantey.com/posts/2026-02-18-your-ai-assistant-can-talk/)
- **README:** [Technical details and architecture](voice/)

Or if you prefer, jump straight in:

### Quick Start

Tell your AI assistant:

> Read https://raw.githubusercontent.com/chriscantey/pai-companion/main/voice/INSTALL.md and follow the setup phases.

---

## Links

- [PAI](https://github.com/danielmiessler/PAI)
- [The Algorithm](https://github.com/danielmiessler/TheAlgorithm)
- [Kokoro TTS](https://github.com/hexgrad/kokoro)
