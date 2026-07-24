# PAI Companion

> **Work in Progress.** This is an evolving onboarding package for PAI (Personal AI Infrastructure). Expect rough edges, missing pieces, and changes.

> **Compatibility:** built for and tested against **PAI v5.0.0**, installed pinned per the [PAI 5 setup guide](https://chriscantey.com/posts/2026-05-12-setting-up-your-personal-ai-assistant-pai-5/). Upstream has since renamed the project to [LifeOS](https://github.com/danielmiessler/LifeOS) and moved to newer versions I haven't tested yet. This package tracks the version running on my own install and on several long-running real deployments, and it will move forward when those do.

PAI Companion adds a web portal, file exchange, and optional voice notifications to your PAI-powered AI assistant. It's designed for users running PAI on a local Linux VM (Debian, Ubuntu, or similar).

## Core: Portal + Exchange

The foundation package. Gives your assistant a portal for displaying web pages, dashboards, and reports, a file exchange for sharing files between your machine and the VM, a clipboard page, and a dark theme design system for all visual output. The portal now includes a **System hub**: twenty browsable pages that group your assistant's brain (skills, agents, context, algorithm), work (ISAs, tasks, sessions), memory (knowledge, reflections, signals, observability, relationships), and config (hooks, settings, plugins) into one place.

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

**Heads up:** The voice module uses Docker containers and needs some room. Plan for 30GB+ total disk on your VM and at least 8GB RAM (16GB is more comfortable). See the [voice README](voice/) for details.

- **Blog post:** [Your AI Assistant Can Talk](https://chriscantey.com/posts/2026-02-18-your-ai-assistant-can-talk/)
- **README:** [Technical details and architecture](voice/)

Or if you prefer, jump straight in:

### Quick Start

Tell your AI assistant:

> Read https://raw.githubusercontent.com/chriscantey/pai-companion/main/voice/INSTALL.md and follow the setup phases.

---

## Optional: Upgrade Module

**Legacy module.** If you're migrating an older install from PAI v3.0 to v4.0, the upgrade module walks your assistant through the process. (For new setups, skip this and start directly on pinned v5.0.0 per the compatibility note above.) It handles version detection, backup, skill migration (flat to hierarchical), hook updates, settings merge, and post-upgrade verification. Each phase is independently verifiable and resumable.

This is a one-time operation, not part of normal setup. If you're doing a fresh install, you don't need this.

- **README:** [Upgrade details and supported paths](upgrade/)

### Quick Start

Tell your AI assistant:

> Read https://raw.githubusercontent.com/chriscantey/pai-companion/main/upgrade/UPGRADE.md and follow the upgrade phases.

---

## Updating Companion

Already have PAI Companion installed and want to update to the latest version? The update process refreshes system portal pages (skills catalog, agent roster, exchange, clipboard, etc.) without touching any pages you've created.

Tell your AI assistant:

> Read https://raw.githubusercontent.com/chriscantey/pai-companion/main/companion/UPGRADE.md and follow the update phases.

---

## Links

- [PAI](https://github.com/danielmiessler/PAI)
- [The Algorithm](https://github.com/danielmiessler/TheAlgorithm)
- [Kokoro TTS](https://github.com/hexgrad/kokoro)
