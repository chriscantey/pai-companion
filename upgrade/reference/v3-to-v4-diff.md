# PAI v3.0 to v4.0 Structural Differences

## Overview

PAI v4.0 reorganizes 38 flat skills into 11 hierarchical categories (~77 skills), slims the hook system, adds a PAI/ documentation directory, and moves to a template-generated CLAUDE.md.

## Skills: Flat to Hierarchical

### v3.0 Upstream Skills (38 flat directories)
```
Agents, AnnualReports, Aphorisms, Apify, Art, BeCreative, BrightData,
Browser, Cloudflare, CORE, Council, CreateCLI, CreateSkill, Documents,
Evals, ExtractWisdom, Fabric, FirstPrinciples, IterativeDepth, OSINT,
PAI, PAIUpgrade, Parser, PrivateInvestigator, Prompting, PromptInjection,
Recon, RedTeam, Remotion, Research, Sales, Science, SECUpdates, Telos,
USMetrics, WebAssessment, WorldThreatModelHarness, WriteStory
```

### v4.0 Skill Categories (11 categories)
```
Agents/           - Agent system (Data/, Scratchpad/, Templates/, Tools/, Workflows/)
ContentAnalysis/   - ExtractWisdom
Investigation/     - OSINT, PrivateInvestigator
Media/            - Art (expanded), Remotion
Research/         - Research (Templates/, Workflows/)
Scraping/         - Apify (expanded), BrightData
Security/         - AnnualReports, PromptInjection, Recon (expanded), SECUpdates, WebAssessment (expanded)
Telos/            - Telos (DashboardTemplate/, ReportTemplate/, Tools/, Workflows/)
Thinking/         - BeCreative, Council, FirstPrinciples, IterativeDepth, RedTeam, Science, WorldThreatModelHarness
USMetrics/        - USMetrics (Tools/, Workflows/)
Utilities/        - Aphorisms, AudioEditor (new), Browser, Cloudflare, CreateCLI, CreateSkill, Delegation (new), Documents, Evals, Fabric, PAIUpgrade, Parser, Prompting
```

### Skills Removed from v4.0
- **CORE** - Integrated into PAI core system
- **Sales** - Removed
- **WriteStory** - Removed
- **PAI** (the skill) - Replaced by PAI/ directory

### Skills Added in v4.0
- **AudioEditor** (Utilities/) - Audio editing
- **Delegation** (Utilities/) - Task delegation system

### Migration Map (v3 path → v4 path)
| v3.0 | v4.0 |
|------|------|
| `skills/Apify/` | `skills/Scraping/Apify/` |
| `skills/Art/` | `skills/Media/Art/` |
| `skills/BeCreative/` | `skills/Thinking/BeCreative/` |
| `skills/BrightData/` | `skills/Scraping/BrightData/` |
| `skills/Browser/` | `skills/Utilities/Browser/` |
| `skills/Cloudflare/` | `skills/Utilities/Cloudflare/` |
| `skills/Council/` | `skills/Thinking/Council/` |
| `skills/CreateCLI/` | `skills/Utilities/CreateCLI/` |
| `skills/CreateSkill/` | `skills/Utilities/CreateSkill/` |
| `skills/Documents/` | `skills/Utilities/Documents/` |
| `skills/Evals/` | `skills/Utilities/Evals/` |
| `skills/ExtractWisdom/` | `skills/ContentAnalysis/ExtractWisdom/` |
| `skills/Fabric/` | `skills/Utilities/Fabric/` |
| `skills/FirstPrinciples/` | `skills/Thinking/FirstPrinciples/` |
| `skills/IterativeDepth/` | `skills/Thinking/IterativeDepth/` |
| `skills/OSINT/` | `skills/Investigation/OSINT/` |
| `skills/PAIUpgrade/` | `skills/Utilities/PAIUpgrade/` |
| `skills/Parser/` | `skills/Utilities/Parser/` |
| `skills/PrivateInvestigator/` | `skills/Investigation/PrivateInvestigator/` |
| `skills/Prompting/` | `skills/Utilities/Prompting/` |
| `skills/PromptInjection/` | `skills/Security/PromptInjection/` |
| `skills/Recon/` | `skills/Security/Recon/` |
| `skills/RedTeam/` | `skills/Thinking/RedTeam/` |
| `skills/Remotion/` | `skills/Media/Remotion/` |
| `skills/Research/` | `skills/Research/` |
| `skills/Science/` | `skills/Thinking/Science/` |
| `skills/SECUpdates/` | `skills/Security/SECUpdates/` |
| `skills/Telos/` | `skills/Telos/` |
| `skills/USMetrics/` | `skills/USMetrics/` |
| `skills/WebAssessment/` | `skills/Security/WebAssessment/` |
| `skills/WorldThreatModelHarness/` | `skills/Thinking/WorldThreatModelHarness/` |
| `skills/Aphorisms/` | `skills/Utilities/Aphorisms/` |

## Hooks: Handler Changes

### v3.0 Hook Handlers (7 files)
```
AlgorithmEnrichment.ts, DocCrossRefIntegrity.ts, RebuildSkill.ts,
SystemIntegrity.ts, TabState.ts, UpdateCounts.ts, VoiceNotification.ts
```

### v4.0 Hook Handlers (6 files)
```
BuildCLAUDE.ts, DocCrossRefIntegrity.ts, SystemIntegrity.ts,
TabState.ts, UpdateCounts.ts, VoiceNotification.ts
```

### Hook Changes
| Change | Handler |
|--------|---------|
| **Removed** | `AlgorithmEnrichment.ts` |
| **Removed** | `RebuildSkill.ts` |
| **Added** | `BuildCLAUDE.ts` (generates CLAUDE.md from template) |
| Kept | `DocCrossRefIntegrity.ts`, `SystemIntegrity.ts`, `TabState.ts`, `UpdateCounts.ts`, `VoiceNotification.ts` |

### Settings.json Hook Config Changes
| v3.0 Hook | Status in v4.0 |
|-----------|----------------|
| VoiceGate (PreToolUse) | **Removed** |
| AlgorithmTracker (PostToolUse) | **Removed** |
| AutoWorkCreation (UserPromptSubmit) | **Removed** |
| SessionSummary (SessionEnd) | **Removed** → replaced by SessionCleanup |
| StartupGreeting (SessionStart) | **Removed** |
| CheckVersion (SessionStart) | **Removed** |
| StopOrchestrator (Stop) | **Removed** |
| PRDSync (PostToolUse) | **Added** |
| SessionCleanup (SessionEnd) | **Added** |
| KittyEnvPersist (SessionStart) | **Added** |
| LastResponseCache (Stop) | **Added** |
| ResponseTabReset (Stop) | **Added** |
| VoiceCompletion (Stop) | **Added** |
| DocIntegrity (Stop) | **Added** |

## New: PAI/ Directory

v4.0 adds a top-level `PAI/` directory with system documentation and tools:

```
PAI/
├── Algorithm/              # Versioned algorithm files (v3.5.0.md, LATEST)
├── Tools/                  # BuildCLAUDE.ts, SessionProgress.ts, etc.
├── USER/                   # User context (portable across upgrades)
│   ├── AISTEERINGRULES.md
│   ├── ENVIRONMENT.md / IDENTITY.md
│   ├── DESIGN.md
│   ├── SKILLCUSTOMIZATIONS/
│   ├── TELOS/
│   ├── PROJECTS/
│   └── WORK/
├── CONTEXT_ROUTING.md
├── PRDFORMAT.md
├── SKILLSYSTEM.md
├── THEHOOKSYSTEM.md
├── MEMORYSYSTEM.md
├── PAISYSTEMARCHITECTURE.md
└── README.md
```

## CLAUDE.md: Stub to Generated

| Aspect | v3.0 | v4.0 |
|--------|------|------|
| Content | Stub ("This file does nothing") | Full system config (modes, algorithm reference, context routing) |
| Generation | Static | Generated from `CLAUDE.md.template` via `BuildCLAUDE.ts` |
| Trigger | N/A | Rebuilt on every SessionStart |
| Template vars | N/A | `{{PAI_VERSION}}`, `{{ALGO_PATH}}`, `{{DAIDENTITY.NAME}}`, etc. |

## Settings.json: Key Structural Changes

- **v4 adds:** `algorithmVersion`, `paiVersion`, counts (skills, hooks, workflows), MCP servers, `loadAtStartup` array
- **v4 changes:** `contextFiles` replaced by `loadAtStartup` for core files
- **v4 removes:** Some v3-specific hook references (VoiceGate, AlgorithmTracker, etc.)
- **Identity:** Same structure (principal, daidentity sections)
- **Hooks:** Reference same handlers/ directory, different hook set

## Memory Directory

Structure is similar between versions:
```
MEMORY/
├── LEARNING/    # Patterns, reflections
├── RELATIONSHIP/ # Interaction context
├── STATE/       # Runtime state (session names, caches)
├── VOICE/       # Voice recordings
└── WORK/        # Session PRDs and artifacts
```

No path changes needed. Content is preserved as-is.
