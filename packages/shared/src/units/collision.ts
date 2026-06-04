import {
  barrierCenterPx,
  isWorldPointOnBarrier,
  pushPointOffBarriers,
  SKIRMISH_MAP_BARRIERS,
} from "../map/barriers.js";
import { CELL_PX, structureDef } from "../structures/defs.js";
import type { BuildSimState, PlacedStructure } from "../structures/building.js";
import { distPx, moveToward, structureCenterPx, unitAlive } from "./geometry.js";
import type { Unit } from "./types.js";

/** Collision circle radius (world px); matches ~28px unit sprite. */
export const UNIT_COLLISION_RADIUS = 14;

const MIN_UNIT_GAP = UNIT_COLLISION_RADIUS * 2;
/** During movement, only block when centers would overlap — separation fixes spacing after the tick. */
const MOVE_UNIT_BLOCK_GAP = UNIT_COLLISION_RADIUS * 1.35;
const SEPARATION_PASSES = 6;

interface Bounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function structureBounds(s: PlacedStructure, margin: number): Bounds {
  const fp = structureDef(s.defId).footprint;
  return {
    x0: s.gx * CELL_PX - margin,
    y0: s.gy * CELL_PX - margin,
    x1: (s.gx + fp.w) * CELL_PX + margin,
    y1: (s.gy + fp.h) * CELL_PX + margin,
  };
}

function pointInBounds(x: number, y: number, b: Bounds): boolean {
  return x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1;
}

function pushPointOutOfBounds(x: number, y: number, b: Bounds): { x: number; y: number } {
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

function blockingStructures(state: BuildSimState): PlacedStructure[] {
  return state.structures.filter((s) => s.buildProgress >= 1 && s.hp > 0);
}

function isTerrainBlocked(
  state: BuildSimState,
  x: number,
  y: number,
): boolean {
  const r = UNIT_COLLISION_RADIUS;
  if (isWorldPointOnBarrier(x, y, r)) return true;
  for (const s of blockingStructures(state)) {
    if (pointInBounds(x, y, structureBounds(s, r))) return true;
  }
  return false;
}

function isUnitBlocked(
  state: BuildSimState,
  x: number,
  y: number,
  ignoreUnitId: string | undefined,
  minGap: number,
): boolean {
  for (const u of state.units) {
    if (!unitAlive(u) || u.instanceId === ignoreUnitId) continue;
    if (distPx(x, y, u.x, u.y) < minGap) return true;
  }
  return false;
}

/** Full placement check (terrain + full unit spacing). */
export function isPositionBlocked(
  state: BuildSimState,
  x: number,
  y: number,
  ignoreUnitId?: string,
): boolean {
  if (isTerrainBlocked(state, x, y)) return true;
  return isUnitBlocked(state, x, y, ignoreUnitId, MIN_UNIT_GAP - 0.5);
}

/** One movement step — terrain is hard; other units only block on true overlap. */
function canUnitStepTo(
  state: BuildSimState,
  x: number,
  y: number,
  ignoreUnitId?: string,
): boolean {
  if (isTerrainBlocked(state, x, y)) return false;
  return !isUnitBlocked(state, x, y, ignoreUnitId, MOVE_UNIT_BLOCK_GAP);
}

export function pushOutOfObstacles(
  state: BuildSimState,
  x: number,
  y: number,
  ignoreUnitId?: string,
): { x: number; y: number } {
  let px = x;
  let py = y;
  const r = UNIT_COLLISION_RADIUS;

  const offBarriers = pushPointOffBarriers(px, py, r);
  px = offBarriers.x;
  py = offBarriers.y;

  for (const s of blockingStructures(state)) {
    const pushed = pushPointOutOfBounds(px, py, structureBounds(s, r));
    px = pushed.x;
    py = pushed.y;
  }

  for (const u of state.units) {
    if (!unitAlive(u) || u.instanceId === ignoreUnitId) continue;
    const d = distPx(px, py, u.x, u.y);
    if (d < MIN_UNIT_GAP && d > 0.001) {
      const f = (MIN_UNIT_GAP - d) / d;
      px += (px - u.x) * f;
      py += (py - u.y) * f;
    } else if (d < 0.001) {
      px += MIN_UNIT_GAP;
    }
  }

  return { x: px, y: py };
}

const DETOUR_ANGLES = [
  0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05, 1.4, -1.4, 1.75, -1.75,
];
const UNSTICK_ANGLES = [Math.PI / 2, -Math.PI / 2, Math.PI * 0.75, -Math.PI * 0.75];

/** Blend goal direction with repulsion from nearby units and structures. */
function steeringDirection(
  state: BuildSimState,
  unitId: string,
  x: number,
  y: number,
  tx: number,
  ty: number,
  options?: { followNavPath?: boolean },
): { dx: number; dy: number; dist: number } {
  let dx = tx - x;
  let dy = ty - y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.001) return { dx: 0, dy: 0, dist: 0 };

  dx /= dist;
  dy /= dist;

  const avoidR = UNIT_COLLISION_RADIUS * 4.5;
  const unitAvoidWeight = options?.followNavPath ? 1.35 : 1.2;
  for (const u of state.units) {
    if (!unitAlive(u) || u.instanceId === unitId) continue;
    const d = distPx(x, y, u.x, u.y);
    if (d > avoidR) continue;
    const push = d > 0.001 ? (MIN_UNIT_GAP - d) / d : 1.5;
    dx += ((x - u.x) / (d || 1)) * push * unitAvoidWeight;
    dy += ((y - u.y) / (d || 1)) * push * unitAvoidWeight;
  }

  const obstacleWeight = options?.followNavPath ? 0.75 : 1;
  for (const s of blockingStructures(state)) {
    const c = structureCenterPx(s);
    const d = distPx(x, y, c.x, c.y);
    if (d > avoidR + CELL_PX) continue;
    const b = structureBounds(s, UNIT_COLLISION_RADIUS);
    if (!pointInBounds(x, y, b) && d > avoidR) continue;
    const push = d > 0.001 ? (CELL_PX * 1.15) / d : 1.2;
    dx += ((x - c.x) / (d || 1)) * push * obstacleWeight;
    dy += ((y - c.y) / (d || 1)) * push * obstacleWeight;
  }

  const r = UNIT_COLLISION_RADIUS;
  for (const barrier of SKIRMISH_MAP_BARRIERS) {
    const b = {
      x0: barrier.gx * CELL_PX - r,
      y0: barrier.gy * CELL_PX - r,
      x1: (barrier.gx + barrier.w) * CELL_PX + r,
      y1: (barrier.gy + barrier.h) * CELL_PX + r,
    };
    const c = barrierCenterPx(barrier);
    if (!pointInBounds(x, y, b) && distPx(x, y, c.x, c.y) > avoidR) {
      continue;
    }
    const d = distPx(x, y, c.x, c.y);
    if (d > avoidR + CELL_PX) continue;
    const push = d > 0.001 ? (CELL_PX * 1.15) / d : 1.2;
    dx += ((x - c.x) / (d || 1)) * push * obstacleWeight;
    dy += ((y - c.y) / (d || 1)) * push * obstacleWeight;
  }

  const len = Math.hypot(dx, dy) || 1;
  return { dx: dx / len, dy: dy / len, dist };
}

export function moveUnitToward(
  state: BuildSimState,
  unitId: string,
  x: number,
  y: number,
  tx: number,
  ty: number,
  speed: number,
  options?: { followNavPath?: boolean },
): { x: number; y: number; arrived: boolean } {
  const { dx, dy, dist } = steeringDirection(state, unitId, x, y, tx, ty, options);
  if (dist < 0.001) return { x, y, arrived: true };

  const baseAngle = Math.atan2(dy, dx);
  const tryStep = (nx: number, ny: number, arrived: boolean) => {
    if (!canUnitStepTo(state, nx, ny, unitId)) return null;
    return {
      x: nx,
      y: ny,
      arrived: arrived || distPx(nx, ny, tx, ty) <= speed * 1.25,
    };
  };

  for (const offset of DETOUR_ANGLES) {
    const a = baseAngle + offset;
    const hit = tryStep(x + Math.cos(a) * speed, y + Math.sin(a) * speed, false);
    if (hit) return hit;
  }

  const direct = moveToward(x, y, tx, ty, speed);
  const directHit = tryStep(direct.x, direct.y, direct.arrived);
  if (directHit) return directHit;

  const xSlide = moveToward(x, y, tx, y, speed);
  const xHit = tryStep(xSlide.x, xSlide.y, false);
  if (xHit) return xHit;

  const ySlide = moveToward(x, y, x, ty, speed);
  const yHit = tryStep(ySlide.x, ySlide.y, false);
  if (yHit) return yHit;

  const steer = steeringDirection(state, unitId, x, y, tx, ty, options);
  const sx = x + steer.dx * speed * 0.75;
  const sy = y + steer.dy * speed * 0.75;
  const steerHit = tryStep(sx, sy, false);
  if (steerHit) return steerHit;

  const half = speed * 0.5;
  for (const offset of DETOUR_ANGLES) {
    const a = baseAngle + offset;
    const hit = tryStep(x + Math.cos(a) * half, y + Math.sin(a) * half, false);
    if (hit) return hit;
  }

  for (const offset of UNSTICK_ANGLES) {
    const a = baseAngle + offset;
    const hit = tryStep(x + Math.cos(a) * speed * 0.9, y + Math.sin(a) * speed * 0.9, false);
    if (hit) return hit;
  }

  const nudged = pushOutOfObstacles(state, x, y, unitId);
  const slide = moveToward(x, y, nudged.x, nudged.y, speed * 0.55);
  const nudgeHit = tryStep(slide.x, slide.y, false);
  if (nudgeHit) return nudgeHit;

  return { x, y, arrived: false };
}

/** Resolve overlaps after movement (structures + other units). */
export function separateUnits(state: BuildSimState): BuildSimState {
  let units = state.units.map((u) => ({ ...u }));

  for (let pass = 0; pass < SEPARATION_PASSES; pass++) {
    for (let i = 0; i < units.length; i++) {
      const u = units[i]!;
      if (!unitAlive(u)) continue;
      let pos = pushOutOfObstacles(
        { ...state, units },
        u.x,
        u.y,
        u.instanceId,
      );
      pos = pushOutOfObstacles({ ...state, units }, pos.x, pos.y, u.instanceId);
      units[i] = { ...u, x: pos.x, y: pos.y };
    }

    for (let i = 0; i < units.length; i++) {
      for (let j = i + 1; j < units.length; j++) {
        const a = units[i]!;
        const b = units[j]!;
        if (!unitAlive(a) || !unitAlive(b)) continue;
        const d = distPx(a.x, a.y, b.x, b.y);
        if (d >= MIN_UNIT_GAP || d < 0.001) continue;
        const overlap = (MIN_UNIT_GAP - d) / 2;
        const nx = (a.x - b.x) / d;
        const ny = (a.y - b.y) / d;
        units[i] = { ...a, x: a.x + nx * overlap, y: a.y + ny * overlap };
        units[j] = { ...b, x: b.x - nx * overlap, y: b.y - ny * overlap };
      }
    }
  }

  return { ...state, units };
}

/** Find a free spawn point near preferred world position. */
export function findSpawnPosition(
  state: BuildSimState,
  preferredX: number,
  preferredY: number,
  ignoreUnitId?: string,
): { x: number; y: number } {
  const offsets = [
    [0, 0],
    [CELL_PX, 0],
    [-CELL_PX, 0],
    [0, CELL_PX],
    [0, -CELL_PX],
    [CELL_PX, CELL_PX],
    [-CELL_PX, CELL_PX],
    [CELL_PX, -CELL_PX],
    [-CELL_PX, -CELL_PX],
    [CELL_PX * 2, 0],
    [-CELL_PX * 2, 0],
    [0, CELL_PX * 2],
  ];

  for (const [ox, oy] of offsets) {
    const x = preferredX + ox;
    const y = preferredY + oy;
    if (!isPositionBlocked(state, x, y, ignoreUnitId)) {
      return { x, y };
    }
  }

  return pushOutOfObstacles(state, preferredX, preferredY, ignoreUnitId);
}
