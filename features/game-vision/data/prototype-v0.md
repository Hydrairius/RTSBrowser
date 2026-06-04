# Prototype v0 — local skirmish

## Mode

| Aspect | Decision |
|--------|----------|
| Players | 1 human + 1+ AI (same machine, same tab) |
| Authority | Single simulation in browser; no server |
| Session | Skirmish / custom game (no campaign) |
| Factions | Human picks 1 of 3; AI assigned a faction (can mirror or counter — TBD) |

## Minimum playable loop

1. **Setup** — Map, player faction, AI faction, difficulty stub
2. **Economy** — One resource type acceptable for v0; expand later
3. **Production** — Build geometric structure → spawn geometric units
4. **Combat** — Select, move, attack; simple HP and damage
5. **Win** — Destroy enemy HQ / eliminate forces (condition TBD)

## AI (v0 bar)

- Gather when low on resources
- Build production on a timer or threshold
- Attack with a grouped squad when army size ≥ N
- Defend or flee when local force ratio is bad (simple heuristic)

Full behavior trees and personality per faction come after the bar is met.

## Technical assumptions (draft)

- Rendering: **PixiJS v8** (WebGL) — see [../../rendering/data/engine-choice.md](../../rendering/data/engine-choice.md); simulation stays separate from renderer
- Simulation: Fixed tick, deterministic-friendly for future replays
- Map: Small grid or few zones; no giant open world

## Open decisions

- [ ] Map size and terrain complexity for first map
- [ ] Single resource vs two (e.g. matter + energy)
- [ ] Fog of war on or off for v0
- [ ] AI difficulty = stat multiplier vs smarter planning
