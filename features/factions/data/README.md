# Data — factions

Mechanics, unit rosters, and structure defs per faction. Visual language summary lives in [../game-vision/data/factions.json](../game-vision/data/factions.json).

## Purpose

- Balance and differentiate **Triad** (triangle), **Loop** (circle), **Block** (square)
- Shared schema for unit/structure defs used by simulation and rendering

## v0 match visuals (implemented)

Skirmish structures use faction **shape themes** in the client (`faction-theme-triad` / `loop` / `block`): triangles, circles, and squares with each faction’s palette. Human build previews use the player’s faction; AI buildings use the opponent’s faction from sim state.

## Planned artifacts

| File | Description |
|------|-------------|
| `units.schema.json` | Shared fields: hp, speed, damage, shape, factionId |
| `triad-units.json` | Triad roster for v0 |
| `loop-units.json` | Loop roster for v0 |
| `block-units.json` | Block roster for v0 |

## Open questions

- [ ] Asymmetric rosters vs mirrored units with stat tweaks?
- [ ] Unique HQ ability per faction in v0 or post-v0?

## Dependencies

- **Upstream**: `game-vision`
- **Downstream**: `units`, `combat`, `structures`, `rendering`
