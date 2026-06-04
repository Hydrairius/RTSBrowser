/** Mirrors features/map-terrain/data/barriers-v0.json — keep in sync. */

import { CELL_PX } from "../structures/defs.js";

export interface MapBarrier {
  id: string;
  gx: number;
  gy: number;
  w: number;
  h: number;
}

/** Impassable rock walls — HQ bowls + three lane funnels. */
export const SKIRMISH_MAP_BARRIERS: readonly MapBarrier[] = [
  { id: "human-bowl-w", gx: 6, gy: 52, w: 3, h: 42 },
  { id: "human-bowl-n", gx: 6, gy: 50, w: 38, h: 3 },
  { id: "human-bowl-s", gx: 6, gy: 94, w: 44, h: 3 },
  { id: "human-ridge-e-n", gx: 48, gy: 54, w: 3, h: 12 },
  { id: "human-ridge-e-s", gx: 48, gy: 72, w: 3, h: 26 },
  { id: "human-n-berm", gx: 58, gy: 12, w: 22, h: 3 },
  { id: "human-n-wing", gx: 72, gy: 15, w: 3, h: 12 },
  { id: "human-block-nm", gx: 55, gy: 32, w: 25, h: 3 },
  { id: "human-block-ms", gx: 52, gy: 78, w: 28, h: 3 },
  { id: "human-s-berm", gx: 54, gy: 112, w: 26, h: 3 },
  { id: "human-s-wing", gx: 72, gy: 98, w: 3, h: 16 },
  { id: "human-gate-n", gx: 78, gy: 30, w: 5, h: 22 },
  { id: "human-gate-m1", gx: 78, gy: 52, w: 5, h: 6 },
  { id: "human-gate-m2", gx: 78, gy: 76, w: 5, h: 22 },
  { id: "human-gate-s", gx: 78, gy: 108, w: 5, h: 24 },

  { id: "neu-cap-n", gx: 83, gy: 0, w: 14, h: 14 },
  { id: "neu-div-nm", gx: 83, gy: 30, w: 14, h: 26 },
  { id: "neu-mid-rock-a", gx: 86, gy: 56, w: 3, h: 12 },
  { id: "neu-mid-rock-b", gx: 92, gy: 64, w: 3, h: 10 },
  { id: "neu-mid-rock-c", gx: 88, gy: 70, w: 4, h: 4 },
  { id: "neu-div-ms", gx: 83, gy: 76, w: 14, h: 22 },
  { id: "neu-cap-s", gx: 83, gy: 114, w: 14, h: 21 },

  { id: "ai-bowl-e", gx: 171, gy: 8, w: 3, h: 38 },
  { id: "ai-bowl-n", gx: 122, gy: 5, w: 52, h: 3 },
  { id: "ai-bowl-s", gx: 118, gy: 47, w: 56, h: 3 },
  { id: "ai-ridge-w-n", gx: 124, gy: 10, w: 3, h: 20 },
  { id: "ai-ridge-w-s", gx: 124, gy: 36, w: 3, h: 14 },
  { id: "ai-n-berm", gx: 98, gy: 12, w: 24, h: 3 },
  { id: "ai-n-wing", gx: 98, gy: 15, w: 3, h: 12 },
  { id: "ai-block-nm", gx: 100, gy: 32, w: 26, h: 3 },
  { id: "ai-block-ms", gx: 102, gy: 78, w: 28, h: 3 },
  { id: "ai-s-berm", gx: 100, gy: 112, w: 26, h: 3 },
  { id: "ai-s-wing", gx: 98, gy: 98, w: 3, h: 16 },
  { id: "ai-gate-n", gx: 97, gy: 30, w: 5, h: 22 },
  { id: "ai-gate-m1", gx: 97, gy: 52, w: 5, h: 6 },
  { id: "ai-gate-m2", gx: 97, gy: 76, w: 5, h: 22 },
  { id: "ai-gate-s", gx: 97, gy: 108, w: 5, h: 24 },
] as const;

export interface BarrierWorldBounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function rectsOverlapCells(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

/** True if a structure footprint overlaps any barrier cell. */
export function footprintOverlapsBarrier(
  gx: number,
  gy: number,
  fp: { w: number; h: number },
): boolean {
  for (const b of SKIRMISH_MAP_BARRIERS) {
    if (rectsOverlapCells(gx, gy, fp.w, fp.h, b.gx, b.gy, b.w, b.h)) {
      return true;
    }
  }
  return false;
}

export function barrierWorldBounds(marginPx = 0): BarrierWorldBounds[] {
  return SKIRMISH_MAP_BARRIERS.map((b) => ({
    x0: b.gx * CELL_PX - marginPx,
    y0: b.gy * CELL_PX - marginPx,
    x1: (b.gx + b.w) * CELL_PX + marginPx,
    y1: (b.gy + b.h) * CELL_PX + marginPx,
  }));
}

function pointInBounds(x: number, y: number, b: BarrierWorldBounds): boolean {
  return x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
}

function pushPointOutOfBounds(
  x: number,
  y: number,
  b: BarrierWorldBounds,
): { x: number; y: number } {
  if (!pointInBounds(x, y, b)) return { x, y };
  const dl = x - b.x0;
  const dr = b.x1 - x;
  const dt = y - b.y0;
  const db = b.y1 - y;
  const min = Math.min(dl, dr, dt, db);
  if (min === dl) return { x: b.x0, y };
  if (min === dr) return { x: b.x1, y };
  if (min === dt) return { x, y: b.y0 };
  return { x, y: b.y1 };
}

export function isWorldPointOnBarrier(x: number, y: number, marginPx = 0): boolean {
  const bounds = barrierWorldBounds(marginPx);
  return bounds.some((b) => pointInBounds(x, y, b));
}

export function pushPointOffBarriers(
  x: number,
  y: number,
  marginPx = 0,
): { x: number; y: number } {
  let px = x;
  let py = y;
  for (const b of barrierWorldBounds(marginPx)) {
    const pushed = pushPointOutOfBounds(px, py, b);
    px = pushed.x;
    py = pushed.y;
  }
  return { x: px, y: py };
}

/** Barrier center in world px (for steering repulsion). */
export function barrierCenterPx(b: MapBarrier): { x: number; y: number } {
  return {
    x: (b.gx + b.w / 2) * CELL_PX,
    y: (b.gy + b.h / 2) * CELL_PX,
  };
}
