# PAI Upgrade

Upgrade workflow for PAI (Personal AI Infrastructure) version migrations.

## Status

**Work in progress.** Planning and drafting the v3.0 to v4.0 upgrade workflow.

## Structure

```
upgrade/
├── README.md              # This file
├── INSTALL.md             # AI-driven upgrade phases (the main deliverable)
├── PREREQUISITES.md       # What you need before upgrading
├── reference/
│   └── v3-to-v4-diff.md   # Structural differences between versions
└── scripts/
    ├── detect-version.sh  # Detect current PAI version
    ├── backup.sh          # Pre-upgrade backup
    └── verify.sh          # Post-upgrade verification
```

## How It Works

The upgrade is AI-driven: you tell your AI assistant to read INSTALL.md and follow the phases. The AI handles detection, backup, migration, and verification. Each phase is independently verifiable and resumable.

## Supported Upgrade Paths

| From | To | Status |
|------|----|--------|
| v3.0 | v4.0 | In progress |
| v4.0.0 | v4.0.1 | Planned |
| v2.5 | v4.0 | Recommends clean install |

## Part Of

[PAI Companion](https://github.com/chriscantey/pai-companion) — this is the `upgrade/` module, alongside `companion/` (core setup) and `voice/` (TTS).
