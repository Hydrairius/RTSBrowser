import { structureDef, type StructureDefId } from "@rtsbrowser/shared";

/** Mirrors features/game-vision/data/factions.json — keep in sync when factions change. */
export type FactionId = "triad" | "loop" | "block";

export type FactionPrimaryShape = "triangle" | "circle" | "square";

export interface FactionDef {
  id: FactionId;
  displayName: string;
  shapeSymbol: string;
  primaryShape: FactionPrimaryShape;
  tagline: string;
  /** One-line play identity for setup and loading tips. */
  description: string;
  /** Flavor lore shown on skirmish setup. */
  backgroundStory: string;
  color: string;
}

export const FACTIONS: FactionDef[] = [
  {
    id: "triad",
    displayName: "Triad",
    shapeSymbol: "△",
    primaryShape: "triangle",
    tagline: "Sharp pressure, flanks, and burst damage",
    description:
      "The Triad believes victory comes from striking where the enemy is weakest — three forces meeting at a single point.",
    backgroundStory:
      "Born from frontier cadres who learned to win with half the numbers, Triad war doctrine treats every battlefield as a wedge. Their prisms catch light like drawn blades; when three fronts align, the line does not hold — it breaks.",
    color: "var(--triad)",
  },
  {
    id: "loop",
    displayName: "Loop",
    shapeSymbol: "○",
    primaryShape: "circle",
    tagline: "Flow, sustain, and encirclement",
    description:
      "Loop commanders trade burst for rhythm, wearing opponents down in widening circles until escape is impossible.",
    backgroundStory:
      "Ancient cartographers mapped the world as nested rings; Loop engineers rebuilt that map in steel and motion. Their formations breathe — retreat, sustain, encircle — until the enemy finds themselves orbiting a center they can never reach.",
    color: "var(--loop)",
  },
  {
    id: "block",
    displayName: "Block",
    shapeSymbol: "□",
    primaryShape: "square",
    tagline: "Anchors, production, and held ground",
    description:
      "Block doctrine is simple: hold the line, expand the grid, and let production outlast anything that cannot push through.",
    backgroundStory:
      "When the first breach walls fell, survivors stacked what remained into perfect squares and called it home. Block builds nothing temporary. Every bracket, every monolith, every slow march forward is another cell in a lattice that intends to stay.",
    color: "var(--block)",
  },
];

export function factionById(id: FactionId): FactionDef {
  const f = FACTIONS.find((x) => x.id === id);
  if (!f) throw new Error(`Unknown faction: ${id}`);
  return f;
}

/** Faction-specific turret labels (shared sim id: `turret`). */
export const FACTION_TURRET_NAMES: Record<FactionId, string> = {
  triad: "Spike Turret",
  loop: "Orbit Guard",
  block: "Bracket Turret",
};

export function turretDisplayName(factionId: FactionId): string {
  return FACTION_TURRET_NAMES[factionId];
}

export function structureDisplayNameForFaction(
  defId: StructureDefId,
  factionId: FactionId,
): string {
  if (defId === "turret") return turretDisplayName(factionId);
  return structureDef(defId).displayName;
}

export function resolveAiFaction(pick: FactionId | "random", exclude?: FactionId): FactionId {
  if (pick !== "random") return pick;
  const pool = exclude ? FACTIONS.map((f) => f.id).filter((id) => id !== exclude) : FACTIONS.map((f) => f.id);
  return pool[Math.floor(Math.random() * pool.length)]!;
}
