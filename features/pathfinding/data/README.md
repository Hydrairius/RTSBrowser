# Data — pathfinding

Movement and group navigation research for RTSBrowser.

## Contents

| File | Description |
|------|-------------|
| `flow-fields-research.md` | Flow-field / integration-field research for mass unit move orders |

## Current implementation (v0)

Hybrid navigation under `packages/shared/src/map/` and `packages/shared/src/units/`:

- `nav-grid.ts` — baked barrier cells
- `pathfind.ts` — A\*, LOS simplify, world waypoints
- `flow-field.ts` — integration + flow field build (`buildFlowField`, `sampleFlowDirection`)
- `units/navigation.ts` — A\* waypoint following
- `units/flow-navigation.ts` — squad flow cache + `moveUnitWithFlow` (move orders with **≥ 6** units)

Chase and small squads still use per-unit A\*.

## Dependencies

- **Upstream:** `map-terrain` (barriers, lanes), `structures` (dynamic blockers)
- **Downstream:** `ai` (attack waves), `core-simulation` (tick budget)

## Open

- [x] Squad flow fields (threshold 6) per `flow-fields-research.md`
- [ ] Dev-only flow debug draw in client
- [ ] Chase / attack-move flow vs A\* decision
