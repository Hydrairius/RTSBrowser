# Fog of war (v0 skirmish)

## Behavior

- **Per-player vision** — Human and AI each maintain `explored` (ever seen) and `visible` (current LOS) grids on the 180×135 map.
- **Providers** — Completed structures and living units reveal cells in a circular radius (Euclidean, cells). HQ has the largest radius; workers the smallest.
- **LOS** — Reuses `hasCellLineOfSight` from pathfinding (rock and built structures block sight).
- **Combat & AI** — Targeting, aggro, turrets, and AI attack/defend only consider enemies the side can currently see.
- **Client** — Low-res fog canvas over terrain; enemy units/structures not drawn until visible; minimap uses the same vision.

## Sight radii (cells)

| Provider | Radius |
|----------|--------|
| HQ | 14 |
| Generator, Barracks, Turret | 9 |
| Striker, Bolter | 11 |
| Worker | 7 |

## Code

- Simulation: `packages/shared/src/vision/`
- Tick: `advancePlayerVision` at end of `advanceSkirmishTick`
- Rendering: `packages/client/src/game/match-fog.ts`
