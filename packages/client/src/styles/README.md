# Client styles

| File | Purpose |
|------|---------|
| `tokens.css` | Design tokens (`--bg`, factions, `--build-*`, `--shape-*` silhouettes) |
| `build-preview.css` | Build-mode ghost, snap ring, valid-tile highlights (grid visible via `.is-building`) |
| `structures.css` | Map structures, placement flash, build grid overlay |

Imported from `style.css`. DOM class hooks: `game/build-preview.ts` (`BUILD_PREVIEW`).

When changing build hover/ghost visuals, edit **tokens** first, then `build-preview.css` — do not duplicate colors in `style.css`.
