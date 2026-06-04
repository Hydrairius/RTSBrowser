# Data — multiplayer

Post–prototype v0: online play, synchronization, and session identity. **Not in v0** — see [game-vision prototype](../../game-vision/data/prototype-v0.md).

## Contents

| File | Description |
|------|-------------|
| [research-networking-auth.md](research-networking-auth.md) | Networking models, transport, protocol sketch, auth patterns, phased roadmap |
| [client-server-split.md](client-server-split.md) | Implemented test harness: who owns tick, AI, auth |

Player-facing flow (auth → queue → lobby → match): [../../ui-hud/data/player-journey.md](../../ui-hud/data/player-journey.md).

## Dependencies

- **Upstream:** `core-simulation` (deterministic fixed tick), `game-vision`, `input-selection` (player intents)
- **Downstream:** `persistence` (cloud saves keyed to identity), `ui-hud` (lobby/match UI)

## Open questions

See §8 in [research-networking-auth.md](research-networking-auth.md).
