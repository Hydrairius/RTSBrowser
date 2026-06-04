/** HQ bowls and lane bands — visual guides; barriers in barriers.ts implement walls. */

import { AI_HQ_SPAWN, CELL_PX, HUMAN_HQ_SPAWN, MAP_COLS, NEUTRAL_ZONE_COLS } from "../structures/defs.js";

export interface MapRect {
  minGx: number;
  maxGx: number;
  minGy: number;
  maxGy: number;
}

export interface NavLane {
  id: "north" | "mid" | "south";
  label: string;
  band: MapRect;
}

const mid = Math.floor(MAP_COLS / 2);
const neutralHalf = Math.floor(NEUTRAL_ZONE_COLS / 2);

/** Open ground around human HQ — matches barrier “bowl” cutouts. */
export const HUMAN_HQ_BOWL: MapRect = {
  minGx: 6,
  maxGx: 48,
  minGy: 50,
  maxGy: 96,
};

/** Open ground around AI HQ. */
export const AI_HQ_BOWL: MapRect = {
  minGx: 118,
  maxGx: 162,
  minGy: 4,
  maxGy: 50,
};

/** Walkable east–west corridors through neutral (and matching funnels). */
export const SKIRMISH_NAV_LANES: readonly NavLane[] = [
  {
    id: "north",
    label: "North pass",
    band: {
      minGx: mid - neutralHalf - 6,
      maxGx: mid + neutralHalf + 6,
      minGy: 14,
      maxGy: 30,
    },
  },
  {
    id: "mid",
    label: "Mid pass",
    band: {
      minGx: mid - neutralHalf - 6,
      maxGx: mid + neutralHalf + 6,
      minGy: 56,
      maxGy: 76,
    },
  },
  {
    id: "south",
    label: "South pass",
    band: {
      minGx: mid - neutralHalf - 6,
      maxGx: mid + neutralHalf + 6,
      minGy: 96,
      maxGy: 116,
    },
  },
] as const;

export function rectSizePx(r: MapRect): { left: number; top: number; width: number; height: number } {
  return {
    left: r.minGx * CELL_PX,
    top: r.minGy * CELL_PX,
    width: (r.maxGx - r.minGx) * CELL_PX,
    height: (r.maxGy - r.minGy) * CELL_PX,
  };
}

export function hqBowlForRole(role: "human" | "ai"): MapRect {
  return role === "human" ? HUMAN_HQ_BOWL : AI_HQ_BOWL;
}

export function hqBowlLabel(role: "human" | "ai"): string {
  return role === "human" ? "HQ ZONE" : "ENEMY HQ ZONE";
}

/** Marker used in UI (not a barrier). */
export function hqSpawnCell(role: "human" | "ai"): { gx: number; gy: number } {
  return role === "human" ? HUMAN_HQ_SPAWN : AI_HQ_SPAWN;
}
