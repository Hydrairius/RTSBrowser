# Rendering engine — PixiJS v8

## Decision

| Aspect | Choice |
|--------|--------|
| Library | [PixiJS](https://pixijs.com/) v8 (MIT) |
| Role | **Rendering only** — not the game simulation |
| Build | Vite + TypeScript (when `src/` is scaffolded) |
| Backend | WebGL by default; WebGPU where supported |

Simulation (fixed tick, ECS, pathfinding, combat, AI) lives in separate modules with **no Pixi imports**. The renderer reads simulation state each frame and draws geometric shapes via Pixi `Graphics` / `GraphicsContext`.

## Rationale

- **Geometric v0 art** — Units and structures are procedural shapes (triangles, circles, squares), not sprite sheets. Pixi v8 `Graphics` matches [visual-theme.md](visual-theme.md) without a texture pipeline.
- **RTS-friendly architecture** — Browser RTS projects commonly split pure sim from Pixi (e.g. OpenFront: core in a Web Worker, Pixi on the main thread). Fits v0 local play and future deterministic replays / multiplayer.
- **Scale path** — Batched WebGL, reusable graphics contexts, optional sim in a `Worker` when unit counts grow.
- **HUD** — Resource bars, build menus, and settings stay **HTML/CSS** overlaid on the canvas (not Pixi UI).

## Conventions

1. **No sim in Pixi** — Game rules never import from `pixi.js`.
2. **Shape drawing** — Prefer shared `GraphicsContext` blueprints per unit/structure type; update position/rotation on the `Graphics` instance. Avoid `.clear()` and full rebuild every frame (see [Pixi Graphics performance guidelines](https://pixijs.com/8.x/guides/components/scene-objects/graphics)).
3. **Layers** — World (terrain, units, effects) on Pixi stage; chrome in DOM.
4. **Camera** — World container transform for pan/zoom; keep screen-space UI in DOM or a fixed HUD layer.

## Out of scope for Pixi

- Physics engine (not needed for grid/RTS movement v0)
- Scene graph as “game state” — scenes are presentation grouping only
- Tilemap editor pipeline — v0 map can be data-driven grid; tile rendering TBD in `map-terrain`

## Related open items

- Exact layer order and zoom limits — document in this feature when `src/` exists
- Minimap implementation — likely scaled `RenderTexture` or separate view
- Motion-reduced mode — disable orbit/pulse tweens ([visual-theme.md](visual-theme.md))

## References

- PixiJS v8 docs: https://pixijs.com/8.x/guides
- Visual theme: [visual-theme.md](visual-theme.md)
- Prototype scope: [../../game-vision/data/prototype-v0.md](../../game-vision/data/prototype-v0.md)
