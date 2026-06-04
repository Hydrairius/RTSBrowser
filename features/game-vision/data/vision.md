# Game vision

## Elevator pitch

A browser RTS where armies are built from **geometric shapes** — circles, triangles, and squares read instantly on the battlefield. The player commands one of **three factions**, each with a distinct silhouette language and play identity, against **local AI** opponents in the first prototype.

## Pillars

1. **Readable at a glance** — Unit role and allegiance come from shape + color, not texture detail.
2. **Browser-first** — Runs in-tab; no install for the prototype. Target desktop browsers first.
3. **Prototype discipline** — Ship local skirmish (1 human vs AI) before any networking.
4. **Faction fantasy through geometry** — Each faction’s units and structures exaggerate one primary shape family.

## Out of scope (until post–prototype v0)

- Online multiplayer, lobbies, matchmaking
- Accounts, cloud saves, progression meta
- Campaign / narrative missions (optional later)
- Mobile-specific UX (design for desktop; don’t block responsive layout)

## Success criteria for prototype v0

- Pick a faction, start a skirmish map, build/gather/attack with basic RTS loop
- At least one AI opponent with recognizable build/attack behavior
- All units and key structures identifiable by geometric silhouette + faction palette
- Stable framerate with modest unit counts (target cap TBD in `core-simulation`)
