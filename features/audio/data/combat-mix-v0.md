# Combat mix v0

## Problem

Combat one-shots were too sharp and stacked too aggressively in headphones during dense fights. The same attack and hit clips could fire many times per tick, creating fatigue and perceived loudness spikes.

## Research notes

Common game-audio handling for repeated combat sounds:

- Keep a clear audio hierarchy so high-priority events are audible without every event being loud.
- Add subtle pitch and volume variation to repeated one-shots to reduce repetition fatigue.
- Cull or cooldown very frequent emitters so a crowd does not become a wall of identical hits.
- Use bus-level safety limits and ducking/limiting as a final protection layer, not as the only mix fix.

References:

- GameJuice, "Audio Variation: Why Your Sound Effects Need a Pool, Not a File"
- SFX Engine, "Common Game Audio Mistakes"
- GameDeveloper, "Game Audio Theory: Ducking"

## v0 implementation

- Combat attack/hit/destroyed clips have lower manifest volumes.
- Combat clips use `volumeVariance` and `rateVariance` for small per-playback variation.
- Combat clips use `cooldownMs` and `maxInstances` to prevent dense fights from stacking too many one-shots.
- The client audio service applies a conservative SFX safety cap after master/SFX bus calculation.

## Future

- Add separate combat / UI / world SFX settings if players need more control.
- Add authored sound pools per event instead of relying only on pitch variation.
- Add distance-based attenuation when camera and world scale are finalized.
