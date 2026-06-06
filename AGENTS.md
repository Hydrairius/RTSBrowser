# RTSBrowser — Agent Guide

Browser-based real-time strategy game with a **geometric shape** visual theme and **three factions**. The first prototype is **local play vs AI in the browser** (no multiplayer). This repo is organized so each **feature** owns its planning artifacts, agent skills, and tooling in one place.

## Prototype v0 (current target)

| Topic | Decision |
|-------|----------|
| Mode | Local skirmish — human vs AI, single tab |
| Factions | 3 — **Triad** (△), **Loop** (○), **Block** (□) — see [features/game-vision/data/factions.json](features/game-vision/data/factions.json) |
| Theme | Units and structures read as geometric shapes; faction = shape family + palette |
| Not in v0 | Online multiplayer, accounts, campaign |

Full scope: [features/game-vision/data/prototype-v0.md](features/game-vision/data/prototype-v0.md).

## How to work here

1. **Find the feature** — Check [features/](#feature-index) below. If the work spans features, start in the most specific folder and link related notes in your summary.
2. **Read before you build** — For a feature, skim `data/` (facts and specs), `skills/` (how agents should behave), and `tools/` (scripts and helpers) before changing game code.
3. **Add, don’t scatter** — New balance tables, design notes, one-off scripts, and feature-specific skills belong under that feature’s `data/`, `skills/`, or `tools/`. Avoid orphan files at repo root unless they are truly global.
4. **Planning first** — Treat `features/*/data/` as design source of truth. Implementation lives in `packages/` (see [src/README.md](src/README.md)).

## Repository layout

```
RTSBrowser/
├── AGENTS.md                 # This file — entry point for agents
├── README.md                 # Project overview + links
├── docs/deployment.md        # GitHub Pages and static hosting
├── features/
│   ├── README.md             # How to add and name features
│   └── <feature-name>/
│       ├── data/             # Specs, schemas, balance, content definitions
│       ├── skills/           # Cursor skills (SKILL.md) for this domain
│       └── tools/            # Scripts, generators, validators for this domain
├── packages/                 # shared, server, client (see src/README.md)
└── src/                      # Pointer README to packages/
```

### Feature folder contract

| Subfolder | Purpose | Examples |
|-----------|---------|----------|
| `data/` | Machine- and human-readable design artifacts | unit stats JSON, map tile defs, GDD snippets, API contracts |
| `skills/` | Agent instructions scoped to this feature | `SKILL.md` for combat resolution, economy tuning |
| `tools/` | Automation used while building the feature | stat importers, map validators, debug CLIs |

Copy [features/_template/](features/_template/) when creating a new feature.

## Feature index

Features are added over time. Each row links to that feature’s agent context.

| Feature | Path | Status | Summary |
|---------|------|--------|---------|
| Game vision | [features/game-vision/](features/game-vision/) | planning | Vision, v0 scope, faction overview |
| Factions | [features/factions/](features/factions/) | planning | Unit/structure defs per faction |
| AI | [features/ai/](features/ai/) | planning | Local opponent behavior for v0 |
| Rendering | [features/rendering/](features/rendering/) | planning | Geometric visual theme |
| Multiplayer | [features/multiplayer/](features/multiplayer/) | planning | Post v0: lockstep sync, auth research |
| UI & HUD | [features/ui-hud/](features/ui-hud/) | planning | Player journey, screens, in-match HUD |
| Structures | [features/structures/](features/structures/) | in progress | Base building, territories, v0 structures |
| Map terrain | [features/map-terrain/](features/map-terrain/) | in progress | Rock barriers / impassable walls on skirmish map |
| Pathfinding | [features/pathfinding/](features/pathfinding/) | research | Flow fields for mass unit movement (see `data/flow-fields-research.md`) |
| Audio | [features/audio/](features/audio/) | in progress | Howler SFX/music manifest, volume buses |
| *(template)* | [features/_template/](features/_template/) | scaffold | Copy this when adding a feature |

### Suggested features (planning — create folders when you start each area)

These are **not** created yet; use them as a backlog when splitting design work:

| Area | Suggested slug | Typical `data/` | Typical `skills/` | Typical `tools/` |
|------|----------------|-----------------|-------------------|------------------|
| Game loop & simulation tick | `core-simulation` | tick rate, fixed-step rules | sim loop conventions | tick profiler, replay harness |
| Rendering & camera | `rendering` | layer order, zoom limits | canvas/WebGL patterns | sprite sheet packer |
| Input & selection | `input-selection` | hotkeys, drag-box rules | selection state machine | input replay |
| Units & entities | `units` | unit defs, components | entity ECS notes | def linter |
| Combat & damage | `combat` | weapons, armor, formulas | combat resolution skill | damage calculator |
| Pathfinding & movement | `pathfinding` | grid/navmesh params | A* / flow-field notes | path visualizer |
| Economy & resources | `economy` | costs, gather rates | balance workflow | economy spreadsheet export |
| ~~Structures & production~~ | `structures` | *(created — see Feature index)* | production rules | build-tree validator |
| Map & terrain | `map-terrain` | biomes, height, fog | map authoring | tile map tools |
| AI (opponents) | `ai` | difficulty tiers, behaviors | AI planner notes | scenario runner |
| Multiplayer & sync | `multiplayer` | net protocol, authority model | sync / rollback | lag simulator — **post v0** |
| ~~UI & HUD~~ | `ui-hud` | *(created — see Feature index)* | UI component rules | layout screenshot diff |
| Audio | `audio` | SFX/music manifest | asset naming | batch converter |
| Persistence & meta | `persistence` | save format, campaigns | save/load skill | save migrator |

## Global conventions

- **Feature slugs**: lowercase kebab-case (`pathfinding`, not `PathFinding`).
- **Skills**: one `SKILL.md` per skill file; follow [Cursor skill format](https://cursor.com/docs/context/skills).
- **Data formats**: prefer JSON or YAML with a short `README.md` in `data/` describing schema; version breaking changes in filenames or a `schema-version` field.
- **Cross-feature dependencies**: document in both features’ `data/README.md` under a “Dependencies” section.
- **PC + mobile support:** New playable functionality must work on both desktop and mobile at the time it lands. Treat responsive layout, touch input, readable HUD scale, and viewport testing as part of the feature acceptance criteria, not a later cleanup task. Track UI-specific requirements in [features/ui-hud/data/mobile-responsive-support.md](features/ui-hud/data/mobile-responsive-support.md).

## Creating a new feature

```bash
# From repo root (PowerShell)
$slug = "combat"
Copy-Item -Recurse features\_template "features\$slug"
# Edit features/<slug>/data/README.md and add a row to the Feature index table above
```

## Decided vs open

**Decided:** local human vs AI; three geometric factions; browser play on PC and mobile; geometric minimalist art.

**Still open** (track in feature `data/` READMEs):

- Map size, resource model (1 vs 2)
- ~~Fog of war~~ — per-player LOS in v0 skirmish ([features/game-vision/data/fog-of-war-v0.md](features/game-vision/data/fog-of-war-v0.md))
- ~~Canvas 2D vs WebGL for v0~~ — **PixiJS v8** ([features/rendering/data/engine-choice.md](features/rendering/data/engine-choice.md))
- Unit cap / performance budget
- Win condition (HQ destroy vs elimination)
- Faction names (**Triad / Loop / Block** are working titles)

Update this file’s **Feature index** whenever a new `features/<name>/` folder is added.
