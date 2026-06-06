# Data — ui-hud

Screens, flows, and in-match HUD layout for RTSBrowser. Product scope spans **v0 local skirmish** and the **post-v0 online journey** (auth, matchmaking, lobby).

## Contents

| File | Description |
|------|-------------|
| [player-journey.md](player-journey.md) | End-to-end UX: entry → match → win/lose; screen inventory and state machine |
| [screens.json](screens.json) | Machine-readable screen IDs and transitions (for implementation / routing) |
| [universal-theme.json](universal-theme.json) | UI color, typography, spacing, and component token catalog (implemented in `packages/client/src/styles/tokens.css`). Token groups include map/world chrome, VFX/combat, HP bars, title/journey backdrop, and tooltips. |
| [controls-v0.json](controls-v0.json) | Read-only default bindings for settings → Controls tab (`packages/client/src/settings/controls-settings-ui.ts`) |
| [mobile-responsive-support.md](mobile-responsive-support.md) | PC + mobile support rule, responsive viewport matrix, touch input plan, and verification expectations |

## Dependencies

- **Upstream:** [game-vision](../../game-vision/data/vision.md), [prototype-v0](../../game-vision/data/prototype-v0.md), [factions.json](../../game-vision/data/factions.json), [visual-theme](../../rendering/data/visual-theme.md)
- **Upstream (online):** [multiplayer](../../multiplayer/data/research-networking-auth.md) (auth phases), [client-server-split](../../multiplayer/data/client-server-split.md) (lobby → tick sync)
- **Downstream:** `packages/client` routing, HUD widgets, matchmaking service (future)

## Implementation

v0 screen flow lives in `packages/client/src/` (`app.ts`, `navigation/router.ts`, `screens/*`). Multiplayer test harness: `?dev=net`.

Main menu version tracker content lives in `packages/client/src/version-updates.ts` so the static browser build can render the latest player-facing updates without a backend.

All new playable functionality must satisfy the PC + mobile acceptance rule in [mobile-responsive-support.md](mobile-responsive-support.md) before it lands.

## Open questions

Tracked in [player-journey.md](player-journey.md) § Open decisions and in [screens.json](screens.json) `openDecisions`.
