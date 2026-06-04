# Data — map terrain

Static layout for the v0 skirmish battle map.

## Contents

| File | Description |
|------|-------------|
| `barriers-v0.json` | Impassable wall segments (grid cells) |
| `matter-deposits-v0.json` | Fixed matter nodes (generator placement only) |
| `layout-v0.md` | HQ bowls + north/mid/south lane diagram |

## v0 rules

- Barriers are **fixed** for the match; they do not take damage or change.
- **Baked nav grid**: barrier cells are pre-marked impassable; A* pathfinding (`packages/shared/src/map/pathfind.ts`) routes troops around walls and buildings.
- Paths prefer **lane centers** (higher cost next to rock) and **offset waypoints** so units do not hug walls; nav-following troops skip wall-steering slides.
- Units follow **waypoints** along the computed path for move and chase orders.
- Players cannot place structures on any barrier cell.
- Barriers may sit in **neutral**, **human**, or **AI** zones to create lanes and chokepoints.
- **Matter deposits**: five fixed cells per HQ bowl; **generators** may only be placed on an unclaimed deposit (one generator per node). Player **◆ matter** (currency) is separate from map nodes.

## Sync with code

`packages/shared/src/map/barriers.ts` mirrors `barriers-v0.json`. `packages/shared/src/map/matter-deposits.ts` mirrors `matter-deposits-v0.json`. Update both when changing layout.

## Dependencies

- **Upstream**: `structures` (map dimensions, territories)
- **Downstream**: [`pathfinding`](../pathfinding/) (flow-field research), `rendering` (barrier sprites)
