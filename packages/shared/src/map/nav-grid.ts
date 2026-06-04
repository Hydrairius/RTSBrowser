/** Baked walkability from map barriers — one byte per map cell. */

import { footprintOverlapsBarrier } from "./barriers.js";
import { MAP_COLS, MAP_ROWS } from "../structures/defs.js";

export function cellIndex(gx: number, gy: number): number {
  return gy * MAP_COLS + gx;
}

export function cellFromIndex(index: number): { gx: number; gy: number } {
  return { gx: index % MAP_COLS, gy: Math.floor(index / MAP_COLS) };
}

function markCoreBarrierCells(): Uint8Array {
  const blocked = new Uint8Array(MAP_COLS * MAP_ROWS);
  for (let gy = 0; gy < MAP_ROWS; gy++) {
    for (let gx = 0; gx < MAP_COLS; gx++) {
      if (footprintOverlapsBarrier(gx, gy, { w: 1, h: 1 })) {
        blocked[cellIndex(gx, gy)] = 1;
      }
    }
  }
  return blocked;
}

/** Rock wall cells — collision uses world geometry; pathfind uses this grid. */
export const STATIC_CELL_BARRIER_CORE: Uint8Array = markCoreBarrierCells();

/** Alias for pathfind walkability (rock only; structures checked dynamically). */
export const STATIC_CELL_BLOCKED: Uint8Array = STATIC_CELL_BARRIER_CORE;

export function isStaticCellBlocked(gx: number, gy: number): boolean {
  if (gx < 0 || gy < 0 || gx >= MAP_COLS || gy >= MAP_ROWS) return true;
  return STATIC_CELL_BLOCKED[cellIndex(gx, gy)] === 1;
}

export function isCoreBarrierCell(gx: number, gy: number): boolean {
  return isStaticCellBlocked(gx, gy);
}

/** True if any neighbor cell is rock (used to penalize wall-hugging in A*). */
export function isNearCoreBarrier(gx: number, gy: number): boolean {
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      if (isCoreBarrierCell(gx + dx, gy + dy)) return true;
    }
  }
  return false;
}
