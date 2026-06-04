# Data — structures

Building placement, construction time, and economy hooks for prototype v0.

## Purpose

- Define **buildable structures** (HQ, economy, production) shared by all factions for v0
- Footprint, cost, and build duration in simulation ticks
- Faction-specific silhouettes come later via `features/factions` + `features/rendering`

## Contents

| File | Description |
|------|-------------|
| `structures-v0.json` | v0 structure roster and balance |

## v0 rules (implemented in `@rtsbrowser/shared`)

- Map grid: **180×135** cells (48px each; 2.5× prior 72×54); world is much larger than the screen — **pan** with click-drag or WASD, **zoom** with wheel or +/−
- **Fog of war** — each side sees only within unit/structure line of sight (rock blocks LOS); unexplored map is hidden, explored areas show terrain shroud until re-scouted
- Territories: **human** builds west of a central neutral strip; **AI** builds east (same rules, automated planner)
- Each player starts with one **HQ** (2×2), **400** matter, at corner spawns in their zone
- New structures must be inside that player's **territory** and within **25** cells (Chebyshev) of their HQ
- **Workers** train at HQ (◆30); they **construct** buildings or **gather** at generators (max **2** per generator, ◆0.5/tick per worker on site)
- **Generators** only on **matter deposits** (five per HQ bowl; see `map-terrain`); each node supports one generator for the match and contains **◆1500** matter
- No footprint overlap; **Generator** does not passively earn — workers must operate it; **Barracks** trains **Striker** (melee) and **Bolter** (ranged)
- **Turret** (1×1, ◆175) — faction-themed defensive tower; auto-fires projectiles at enemies within 8 cells (Triad Spike / Loop Orbit / Block Bracket display names on client)
- Structures have **HP** (HQ 800, Barracks 450, Generator 200, Turret 300); combat in `@rtsbrowser/shared` units module
- AI places generators, barracks, and turrets on a timer when it has matter

## Dependencies

- **Upstream**: `game-vision` (prototype loop), `economy` (single resource — informal until `features/economy` exists), `map-terrain` (rock barriers on skirmish grid)
- **Downstream**: `units` (spawn from barracks), `ai` (AI build planner), `rendering` (Pixi structure sprites)

## Sync with code

`packages/shared/src/structures/defs.ts` mirrors `structures-v0.json`. Update both when changing balance.

## Open questions

- [ ] Faction-unique structure variants vs shared defs with shape skins
- [ ] Power radius vs HQ tether for expansion
- [ ] Repair / cancel construction
