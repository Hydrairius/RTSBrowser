# Data — ai

Local-browser opponent for prototype v0. No network; AI runs on the same simulation tick as the human.

## v0 goals

See [../game-vision/data/prototype-v0.md](../game-vision/data/prototype-v0.md#ai-v0-bar).

## Planned artifacts

| File | Description |
|------|-------------|
| `v0-behavior.md` | Combat stance: defend base vs attack waves (implemented) |
| `difficulty.json` | Scalar tweaks (income, reaction delay, army threshold) |
| `personality-stub.json` | Optional per-faction weights (aggression, expand timing) |

## Open questions

- [ ] One AI script for all factions vs faction-weighted preferences?
- [ ] Cheating (resource bonus) allowed on hard difficulty for v0?

## Dependencies

- **Upstream**: `game-vision`, `factions`, `economy`, `map-terrain`
- **Downstream**: `core-simulation` (AI tick hook)
