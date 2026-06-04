# AI v0 — combat priorities

Implemented in `packages/shared/src/ai/policy.ts` and `packages/shared/src/units/ai-units.ts`.

## Stance (each tick)

| Stance | When |
|--------|------|
| **defend** | Human units near AI HQ (~18 cells) or any AI structure (~10 cells), and AI has ≥2 units |
| **attack** | No local threats, army ≥ scaled minimum, and a **visible** human target exists |
| **scout** | No local threats, ≥2 combat units idle, and no visible human targets — move toward neutral lane midpoints |
| **hold** | Otherwise (economy / training; no new attack waves) |

Defense overrides offense: attack waves are not issued while `defend` is active.

## Defend

- Re-evaluate every **18** build ticks
- Target: human unit closest to AI HQ
- Pull idle/moving units plus **recall** attackers that are far from base (>10 cells from HQ)
- Wave size scales with threat count (more intruders → more defenders)

## Attack

- Waves on the slower attack interval (unchanged scaling)
- Only idle/moving units (defenders stay on threatened targets via combat aggro)
- Soft targets before HQ when army &lt; 12
- Requires fog-visible enemy units or structures

## Scout

- Re-evaluate every **38** build ticks
- Up to **2** idle/moving combat units per wave (westernmost first)
- Destination rotates across north / mid / south neutral lane centers (gx 88)
- When army is attack-ready but nothing is visible, scout replaces attack until LOS reveals the human base
