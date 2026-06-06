export interface VersionUpdate {
  version: string;
  date: string;
  title: string;
  highlights: string[];
}

export const GAME_VERSION = "v0.0.3-preview";

export const VERSION_UPDATES: VersionUpdate[] = [
  {
    version: GAME_VERSION,
    date: "June 4, 2026",
    title: "Mobile support foundation",
    highlights: [
      "Removed the mobile warning gate so phone and touch users can enter the skirmish flow directly.",
      "Added responsive match HUD layout, safe-area viewport handling, and larger touch controls.",
      "Added touch camera pan, pinch zoom, and tap-to-order support for local skirmish play.",
    ],
  },
  {
    version: "v0.0.2-preview",
    date: "June 4, 2026",
    title: "Movement polish",
    highlights: [
      "Improved unit separation so troops and workers can pull away from packed groups.",
      "Reduced pack clumping during local skirmish movement and worker tasks.",
      "Added regression coverage for collision and worker movement behavior.",
    ],
  },
  {
    version: "v0.0.1-preview",
    date: "June 3, 2026",
    title: "Local skirmish foundation",
    highlights: [
      "Playable local skirmish against AI with Triad, Loop, and Block factions.",
      "HQ, barracks, generators, workers, troop training, and basic combat are online.",
      "Geometric title flow, match HUD, minimap, fog of war, and audio settings are available.",
    ],
  },
];
