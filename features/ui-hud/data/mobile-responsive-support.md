# Mobile and responsive support plan

**Status:** planning  
**Scope:** v0 local skirmish and future online screens  
**Rule:** Every new playable feature must work on PC and mobile when it lands.

RTSBrowser is still designed for browser play first, but "browser" now includes desktop, laptop, tablet, and phone viewports. Mobile support is not a separate port.

## Acceptance rule

Any new gameplay, screen, overlay, HUD widget, or setting is acceptable only when it satisfies all of these:

| Area | Requirement |
|------|-------------|
| Layout | Fits without horizontal page scroll at 360px, 390px, 768px, 1024px, and desktop widths. |
| Input | Has mouse/keyboard behavior on PC and touch behavior on mobile. |
| Readability | Primary text and controls remain legible at phone size without overlapping the game viewport or each other. |
| Controls | Interactive targets are at least 44px on touch layouts unless the control is non-critical and duplicated elsewhere. |
| Viewport | Uses dynamic viewport units or safe-area handling where needed so browser chrome and notches do not hide controls. |
| Performance | Does not add mobile-only jank to match start, camera movement, selection, build placement, or HUD updates. |
| Verification | Has at least one desktop and one mobile manual or automated check recorded in the implementation summary. |

## Target viewports

Use these as the minimum responsive test matrix:

| Class | Size | Purpose |
|-------|------|---------|
| Small phone | 360 x 740 | Worst-case narrow layout and touch density. |
| Common phone | 390 x 844 | Main portrait phone target. |
| Phone landscape | 844 x 390 | RTS play should remain possible with compressed HUD. |
| Tablet portrait | 768 x 1024 | Larger touch layout with more HUD room. |
| Tablet landscape | 1024 x 768 | Near-desktop layout with touch targets. |
| Desktop | 1440 x 900 | Primary PC layout. |

## Layout strategy

- Use responsive CSS grid/flex layouts for menu screens, setup, settings, and results.
- Keep match UI full-screen: Pixi canvas fills the viewport, and HUD chrome overlays it without pushing the canvas offscreen.
- Prefer adaptive HUD regions over hidden functionality. If space is tight, collapse details into drawers, tabs, or icon buttons, but keep the same commands available.
- Avoid fixed pixel-only panels for major regions. Use `min()`, `max()`, `clamp()`, safe-area insets, and stable component dimensions.
- Do not rely on hover-only explanations or hover-only controls. Touch layouts need visible or tappable alternatives.

## Input strategy

| Feature | PC behavior | Mobile behavior |
|---------|-------------|-----------------|
| Camera pan | WASD, arrows, drag, minimap click | One-finger drag on map; minimap tap when visible. |
| Camera zoom | Mouse wheel, +/- | Pinch zoom; optional zoom buttons if pinch is unreliable. |
| Select entity | Left click | Tap. |
| Multi-select | Drag box, Shift-click | Drag-select gesture or explicit selection mode toggle. |
| Issue order | Right click | Context command button plus map tap, or long-press fallback where appropriate. |
| Build placement | Click command, click map | Tap command, tap map, clear cancel affordance. |
| Pause/menu | Keyboard/menu button | Persistent touch-safe menu button. |

## v0 implementation phases

1. **Foundation**
   - Add viewport meta and safe-area CSS handling if missing.
   - Define shared responsive tokens for touch target size, HUD gaps, panel widths, and bottom safe area.
   - Add a Playwright or browser screenshot checklist for the target matrix.

2. **Journey screens**
   - Make title, skirmish setup, loading, settings, and results responsive.
   - Replace hover-only faction detail with tap/click-visible detail.
   - Ensure settings tabs and controls lists fit narrow screens.

3. **In-match HUD**
   - Create desktop, tablet, and phone HUD arrangements.
   - On phones, prioritize resources, selected entity, command buttons, minimap access, and menu.
   - Move secondary information into drawers or compact toggles.

4. **Touch gameplay**
   - Implement touch camera pan and pinch zoom.
   - Add tap selection and touch-safe command flow.
   - Add build placement cancel/confirm controls suitable for fingers.

5. **Regression gate**
   - Before landing new functionality, check one desktop viewport and at least one mobile viewport.
   - For UI-heavy changes, check the full matrix above.
   - Record any known mobile limitation in the owning feature `data/README.md`; do not leave it implicit.

## Open decisions

- Whether phone play defaults to portrait, landscape, or supports both equally.
- Whether right-click orders become a command-mode workflow on mobile or use long-press/context gestures.
- Whether minimap remains always visible on phone or moves behind a tactical drawer.
- Whether mobile gets optional UI scale presets beyond the existing video settings plan.
