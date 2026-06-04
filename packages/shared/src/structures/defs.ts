/** Mirrors features/structures/data/structures-v0.json — keep in sync. */

/** Skirmish grid — 2.5× prior 72×54 prototype (see structures-v0.json). */
export const MAP_COLS = 180;
export const MAP_ROWS = 135;
export const CELL_PX = 48;
export const NEUTRAL_ZONE_COLS = 15;

export const STARTING_MATTER = 400;
export const BUILD_RANGE_FROM_HQ = 25;
/** Client match runs building sim at 10 ticks/s. */
export const BUILD_TICK_MS = 100;
/** AI attempts a new structure every N build ticks. */
export const AI_BUILD_INTERVAL_TICKS = 35;

export const HUMAN_PLAYER_ID = "human";
export const AI_PLAYER_ID = "ai";

/** Southwest base — visible after camera focuses on match start. */
export const HUMAN_HQ_SPAWN = { gx: 25, gy: 70 };
export const AI_HQ_SPAWN = { gx: 135, gy: 25 };

export type PlayerRole = "human" | "ai";
export type StructureCategory = "core" | "economy" | "production" | "defense";
export type StructureDefId = "hq" | "generator" | "barracks" | "turret";

export interface Footprint {
  w: number;
  h: number;
}

export interface PlayerZone {
  minGx: number;
  maxGx: number;
  minGy: number;
  maxGy: number;
}

export interface StructureDef {
  id: StructureDefId;
  displayName: string;
  category: StructureCategory;
  footprint: Footprint;
  cost: number;
  buildTimeTicks: number;
  /** Matter per worker per tick when operating a built generator (max 2 workers). */
  incomePerTick?: number;
  maxPerPlayer?: number;
  /** Defense turrets — world px range, damage, cooldown, projectile speed. */
  turretRangePx?: number;
  turretDamage?: number;
  turretCooldownTicks?: number;
  turretProjectileSpeed?: number;
}

export const STRUCTURE_DEFS: StructureDef[] = [
  {
    id: "hq",
    displayName: "HQ",
    category: "core",
    footprint: { w: 2, h: 2 },
    cost: 0,
    buildTimeTicks: 0,
    maxPerPlayer: 1,
  },
  {
    id: "generator",
    displayName: "Generator",
    category: "economy",
    footprint: { w: 1, h: 1 },
    cost: 120,
    buildTimeTicks: 30,
    incomePerTick: 1,
  },
  {
    id: "barracks",
    displayName: "Barracks",
    category: "production",
    footprint: { w: 2, h: 1 },
    cost: 150,
    buildTimeTicks: 45,
  },
  {
    id: "turret",
    displayName: "Turret",
    category: "defense",
    footprint: { w: 1, h: 1 },
    cost: 175,
    buildTimeTicks: 40,
    turretRangePx: CELL_PX * 8,
    turretDamage: 12,
    turretCooldownTicks: 15,
    turretProjectileSpeed: 16,
  },
];

const defMap = new Map(STRUCTURE_DEFS.map((d) => [d.id, d]));

export function structureDef(id: StructureDefId): StructureDef {
  const d = defMap.get(id);
  if (!d) throw new Error(`Unknown structure: ${id}`);
  return d;
}

export const BUILDABLE_STRUCTURE_IDS: StructureDefId[] = [
  "generator",
  "barracks",
  "turret",
];

export function worldSizePx(): { width: number; height: number } {
  return { width: MAP_COLS * CELL_PX, height: MAP_ROWS * CELL_PX };
}

/** West / east territories with a neutral strip down the center. */
export function zoneForRole(role: PlayerRole): PlayerZone {
  const mid = Math.floor(MAP_COLS / 2);
  const half = Math.floor(NEUTRAL_ZONE_COLS / 2);
  if (role === "human") {
    return { minGx: 0, maxGx: mid - half, minGy: 0, maxGy: MAP_ROWS };
  }
  return { minGx: mid + half, maxGx: MAP_COLS, minGy: 0, maxGy: MAP_ROWS };
}

export function neutralZoneBounds(): PlayerZone {
  const mid = Math.floor(MAP_COLS / 2);
  const half = Math.floor(NEUTRAL_ZONE_COLS / 2);
  return { minGx: mid - half, maxGx: mid + half, minGy: 0, maxGy: MAP_ROWS };
}
