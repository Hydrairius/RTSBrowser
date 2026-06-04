# Visual theme — geometric shapes

## Direction

Minimalist battlefield: **flat fills**, **crisp edges**, **no bitmap sprites** for units in v0. Faction = **palette + primary shape**. Role = **size, outline, or compound shape** (e.g. triangle + small circle = support).

## Shape vocabulary

| Shape | Faction | Unit read |
|-------|---------|-----------|
| Triangle | Triad | Fast movers; point facing = aim direction |
| Circle | Loop | Orbit / pulse animation for idle; smooth movement |
| Square | Block | Structures and tanks; axis-aligned for “anchored” feel |

## Composition rules

1. **Silhouette first** — At 32×32 logical px, shape must read without labels.
2. **Selection** — White or faction-bright outline + corner brackets (square handles echo Block UI).
3. **Team color** — Fill = faction accent; stroke = darker shade; neutral terrain = desaturated grid.
4. **Effects** — Geometric particles only: lines, arcs, expanding rings (no smoke textures).
5. **HQ** — Compound shape: faction primary + unique secondary (prism, ring fort, monolith).

## Camera & map (draft)

- Top-down or slight isometric TBD; top-down favors shape clarity for v0
- Grid optional; if used, subtle lines so squares “belong” on Block turf

## Accessibility

- Do not rely on color alone: shape differs per faction
- Motion-reduced mode: disable orbit/pulse loops (future `ui-hud` setting)

## v0 match (DOM)

Structures, build previews, and placement ghosts use **faction CSS themes** (`faction-theme-triad` / `loop` / `block`) in `packages/client` — triangle clip-path, circle radius, square corners — tinted with each faction’s `--triad` / `--loop` / `--block` color.

**Units** (`packages/client/src/styles/units.css`, `game/unit-visuals.ts`):

| Role | Read | Triad | Loop | Block |
|------|------|-------|------|-------|
| Striker (melee) | Larger solid glyph | Full triangle | Filled circle | Large square |
| Bolter (ranged) | Smaller hollow + core | Inset triangle ring | Ring + center dot | Small square frame + core |

Train buttons and minimap dots reuse the same faction + role classes.

Build ghost/snap/range styling is tokenized in `packages/client/src/styles/tokens.css` (`--build-*`) and `build-preview.css`; class hooks in `game/build-preview.ts`.

**UI chrome** uses the same token file plus [universal-theme.json](../../ui-hud/data/universal-theme.json) for journey screens, HUD, and overlays.

## References in repo

- Faction ids and palette hints: [../../game-vision/data/factions.json](../../game-vision/data/factions.json)
