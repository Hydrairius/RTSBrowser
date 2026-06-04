import { cellIndex, cellFromIndex, isStaticCellBlocked } from "../map/nav-grid.js";
import { worldToNavCell } from "../map/pathfind.js";
import type { BuildSimState, PlacedStructure } from "../structures/building.js";
import { structureDef, MAP_COLS, MAP_ROWS, type StructureDefId } from "../structures/defs.js";
import { structureCenterPx, unitAlive } from "../units/geometry.js";
import type { UnitDefId } from "../units/defs.js";
import type { Unit } from "../units/types.js";

export const MAP_CELL_COUNT = MAP_COLS * MAP_ROWS;

/** Sight radius in grid cells (Euclidean), per provider type. */
export const SIGHT_RADIUS_HQ_CELLS = 14;
export const SIGHT_RADIUS_STRUCTURE_CELLS = 9;
/** Incomplete buildings still reveal the build site. */
export const SIGHT_RADIUS_CONSTRUCTING_CELLS = 6;
export const SIGHT_RADIUS_COMBAT_UNIT_CELLS = 11;
export const SIGHT_RADIUS_WORKER_CELLS = 7;

export interface PlayerVision {
  /** Ever seen by this player (persists). */
  explored: Uint8Array;
  /** Currently in line of sight (cleared each tick). */
  visible: Uint8Array;
}

export interface VisionState {
  byPlayer: Map<string, PlayerVision>;
}

export function createPlayerVision(): PlayerVision {
  return {
    explored: new Uint8Array(MAP_CELL_COUNT),
    visible: new Uint8Array(MAP_CELL_COUNT),
  };
}

export function createVisionForPlayers(playerIds: string[]): VisionState {
  const byPlayer = new Map<string, PlayerVision>();
  for (const id of playerIds) {
    byPlayer.set(id, createPlayerVision());
  }
  return { byPlayer };
}

export function getPlayerVision(
  state: BuildSimState,
  playerId: string,
): PlayerVision | undefined {
  return state.vision?.byPlayer.get(playerId);
}

export function isCellExplored(vision: PlayerVision, gx: number, gy: number): boolean {
  if (gx < 0 || gy < 0 || gx >= MAP_COLS || gy >= MAP_ROWS) return false;
  return vision.explored[cellIndex(gx, gy)] === 1;
}

export function isCellVisible(vision: PlayerVision, gx: number, gy: number): boolean {
  if (gx < 0 || gy < 0 || gx >= MAP_COLS || gy >= MAP_ROWS) return false;
  return vision.visible[cellIndex(gx, gy)] === 1;
}

function sightRadiusForStructure(defId: StructureDefId): number {
  return defId === "hq" ? SIGHT_RADIUS_HQ_CELLS : SIGHT_RADIUS_STRUCTURE_CELLS;
}

function sightRadiusForUnit(defId: UnitDefId): number {
  return defId === "worker" ? SIGHT_RADIUS_WORKER_CELLS : SIGHT_RADIUS_COMBAT_UNIT_CELLS;
}

/** Rock barriers block sight; structures do not (v0). */
function hasVisionLineOfSight(ax: number, ay: number, bx: number, by: number): boolean {
  let x0 = ax;
  let y0 = ay;
  const x1 = bx;
  const y1 = by;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    if (isStaticCellBlocked(x0, y0)) return false;
    if (x0 === x1 && y0 === y1) return true;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }
}

function revealFromCell(
  _state: BuildSimState,
  vision: PlayerVision,
  sx: number,
  sy: number,
  radiusCells: number,
): void {
  const r2 = radiusCells * radiusCells;
  for (let dy = -radiusCells; dy <= radiusCells; dy++) {
    for (let dy2 = dy * dy, dx = -radiusCells; dx <= radiusCells; dx++) {
      if (dx * dx + dy2 > r2) continue;
      const gx = sx + dx;
      const gy = sy + dy;
      if (gx < 0 || gy < 0 || gx >= MAP_COLS || gy >= MAP_ROWS) continue;
      if (!hasVisionLineOfSight(sx, sy, gx, gy)) continue;
      const idx = cellIndex(gx, gy);
      vision.explored[idx] = 1;
      vision.visible[idx] = 1;
    }
  }
}

function revealProvidersForPlayer(
  state: BuildSimState,
  playerId: string,
  vision: PlayerVision,
): void {
  for (const s of state.structures) {
    if (s.ownerId !== playerId) continue;
    const center = structureCenterPx(s);
    const cell = worldToNavCell(center.x, center.y);
    if (s.buildProgress >= 1 && s.hp > 0) {
      revealFromCell(state, vision, cell.gx, cell.gy, sightRadiusForStructure(s.defId));
    } else if (s.buildProgress > 0) {
      revealFromCell(state, vision, cell.gx, cell.gy, SIGHT_RADIUS_CONSTRUCTING_CELLS);
    }
  }

  for (const u of state.units) {
    if (u.ownerId !== playerId || !unitAlive(u)) continue;
    const cell = worldToNavCell(u.x, u.y);
    revealFromCell(state, vision, cell.gx, cell.gy, sightRadiusForUnit(u.defId));
  }
}

/** Recompute visible cells and merge into explored for every player. */
export function advancePlayerVision(state: BuildSimState): BuildSimState {
  if (!state.vision) return state;

  for (const vision of state.vision.byPlayer.values()) {
    vision.visible.fill(0);
  }

  for (const playerId of state.vision.byPlayer.keys()) {
    const vision = state.vision.byPlayer.get(playerId)!;
    revealProvidersForPlayer(state, playerId, vision);
  }

  return state;
}

export function isUnitVisibleToPlayer(
  state: BuildSimState,
  playerId: string,
  unit: Unit,
): boolean {
  if (unit.ownerId === playerId) return true;
  const vision = getPlayerVision(state, playerId);
  if (!vision) return true;
  const cell = worldToNavCell(unit.x, unit.y);
  return isCellVisible(vision, cell.gx, cell.gy);
}

export function isStructureVisibleToPlayer(
  state: BuildSimState,
  playerId: string,
  structure: PlacedStructure,
): boolean {
  if (structure.ownerId === playerId) return true;
  const vision = getPlayerVision(state, playerId);
  if (!vision) return true;
  const fp = structureDef(structure.defId).footprint;
  for (let gy = structure.gy; gy < structure.gy + fp.h; gy++) {
    for (let gx = structure.gx; gx < structure.gx + fp.w; gx++) {
      if (isCellVisible(vision, gx, gy)) return true;
    }
  }
  return false;
}

export function isEnemyVisibleToPlayer(
  state: BuildSimState,
  observerId: string,
  enemyOwnerId: string,
  targetId: string,
  targetKind: "unit" | "structure",
): boolean {
  if (enemyOwnerId === observerId) return true;
  if (targetKind === "unit") {
    const u = state.units.find((x) => x.instanceId === targetId);
    return u ? isUnitVisibleToPlayer(state, observerId, u) : false;
  }
  const s = state.structures.find((x) => x.instanceId === targetId);
  return s ? isStructureVisibleToPlayer(state, observerId, s) : false;
}

/** True when any cell in the AI territory band has been explored by the human. */
export function humanHasExploredAiTerritory(state: BuildSimState): boolean {
  const vision = getPlayerVision(state, "human");
  const zone = state.zones.get("ai");
  if (!vision || !zone) return false;
  for (let gy = zone.minGy; gy < zone.maxGy; gy += 4) {
    for (let gx = zone.minGx; gx < zone.maxGx; gx += 4) {
      if (isCellExplored(vision, gx, gy)) return true;
    }
  }
  return false;
}

/** Sample explored fraction for debug (0–1). */
export function exploredFraction(vision: PlayerVision): number {
  let n = 0;
  for (let i = 0; i < MAP_CELL_COUNT; i++) {
    if (vision.explored[i]) n++;
  }
  return n / MAP_CELL_COUNT;
}

export function visibleCellList(vision: PlayerVision): { gx: number; gy: number }[] {
  const out: { gx: number; gy: number }[] = [];
  for (let i = 0; i < MAP_CELL_COUNT; i++) {
    if (vision.visible[i]) out.push(cellFromIndex(i));
  }
  return out;
}
