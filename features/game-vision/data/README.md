# Data — game-vision

Cross-cutting product and prototype scope. Feature-specific numbers live in sibling features (`factions`, `ai`, `rendering`, etc.).

| File | Description |
|------|-------------|
| [vision.md](vision.md) | Pillars, audience, out-of-scope |
| [prototype-v0.md](prototype-v0.md) | First playable: local human vs AI |
| [factions.json](factions.json) | Three factions — Triad, Loop, Block |

Player flow (title → faction → match → results): [../../ui-hud/data/player-journey.md](../../ui-hud/data/player-journey.md).

## Locked decisions (v0)

- Local play only; AI opponents in-browser
- Three playable factions with geometric shape identity
- Visual theme: geometric shapes ([`../rendering/data/visual-theme.md`](../rendering/data/visual-theme.md))
- Rendering: PixiJS v8 ([`../rendering/data/engine-choice.md`](../rendering/data/engine-choice.md))

## Dependencies

- **Downstream**: `factions`, `ai`, `rendering`, `core-simulation`, `ui-hud`
