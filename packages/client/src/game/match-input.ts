import {
  CELL_PX,
  HUMAN_PLAYER_ID,
  isStructureVisibleToPlayer,
  isUnitVisibleToPlayer,
  isWorkerUnit,
  issueAttackOrder,
  issueMoveOrderSpread,
  issueWorkersGather,
  setProductionRallyPoint,
  structureCenterPx,
  structureDef,
  type BuildSimState,
  type TargetKind,
  type Unit,
} from "@rtsbrowser/shared";
import { clientToWorld, worldToClient } from "./map-camera.js";
import type { MapCamera } from "./map-camera.js";

/** Screen-space click radius for unit picks (constant across zoom). */
const UNIT_HIT_RADIUS_SCREEN_PX = 20;

export function pickUnitAt(
  state: BuildSimState,
  worldX: number,
  worldY: number,
  ownerId?: string,
  worldHitRadiusPx = 18,
): Unit | null {
  let best: Unit | null = null;
  let bestD = worldHitRadiusPx;

  for (const u of state.units) {
    if (u.hp <= 0) continue;
    if (ownerId && u.ownerId !== ownerId) continue;
    const d = Math.hypot(u.x - worldX, u.y - worldY);
    if (d < bestD) {
      bestD = d;
      best = u;
    }
  }
  return best;
}

export function pickEnemyTargetAt(
  state: BuildSimState,
  humanId: string,
  worldX: number,
  worldY: number,
  worldHitRadiusPx = 18,
): { targetId: string; targetKind: TargetKind } | null {
  const enemyUnit = pickUnitAt(state, worldX, worldY, undefined, worldHitRadiusPx);
  if (
    enemyUnit &&
    enemyUnit.ownerId !== humanId &&
    isUnitVisibleToPlayer(state, humanId, enemyUnit)
  ) {
    return { targetId: enemyUnit.instanceId, targetKind: "unit" };
  }

  let best: { targetId: string; targetKind: TargetKind; dist: number } | null = null;
  const hit = Math.max(CELL_PX * 0.55, worldHitRadiusPx);

  for (const s of state.structures) {
    if (s.ownerId === humanId || s.buildProgress < 1 || s.hp <= 0) continue;
    if (!isStructureVisibleToPlayer(state, humanId, s)) continue;
    const def = structureDef(s.defId);
    const cx = (s.gx + def.footprint.w / 2) * CELL_PX;
    const cy = (s.gy + def.footprint.h / 2) * CELL_PX;
    const d = Math.hypot(cx - worldX, cy - worldY);
    if (d < hit && (!best || d < best.dist)) {
      best = { targetId: s.instanceId, targetKind: "structure", dist: d };
    }
  }

  return best ? { targetId: best.targetId, targetKind: best.targetKind } : null;
}

export function pickFriendlyBarracksAt(
  state: BuildSimState,
  worldX: number,
  worldY: number,
): string | null {
  for (const s of state.structures) {
    if (s.ownerId !== HUMAN_PLAYER_ID || s.defId !== "barracks") continue;
    if (s.buildProgress < 1 || s.hp <= 0) continue;
    const def = structureDef(s.defId);
    const x0 = s.gx * CELL_PX;
    const y0 = s.gy * CELL_PX;
    const x1 = x0 + def.footprint.w * CELL_PX;
    const y1 = y0 + def.footprint.h * CELL_PX;
    if (worldX >= x0 && worldX <= x1 && worldY >= y0 && worldY <= y1) {
      return s.instanceId;
    }
  }
  return null;
}

export function unitsInScreenBox(
  state: BuildSimState,
  ownerId: string,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  camera: MapCamera,
  viewportRect: DOMRect,
  worldEl?: HTMLElement | null,
): string[] {
  const minSx = Math.min(x0, x1);
  const maxSx = Math.max(x0, x1);
  const minSy = Math.min(y0, y1);
  const maxSy = Math.max(y0, y1);
  const ids: string[] = [];

  for (const u of state.units) {
    if (u.ownerId !== ownerId || u.hp <= 0) continue;
    let sx: number;
    let sy: number;
    if (worldEl) {
      const c = worldToClient(u.x, u.y, worldEl);
      sx = c.clientX;
      sy = c.clientY;
    } else {
      sx = (u.x - camera.x) * camera.zoom + viewportRect.left;
      sy = (u.y - camera.y) * camera.zoom + viewportRect.top;
    }
    if (sx >= minSx && sx <= maxSx && sy >= minSy && sy <= maxSy) {
      ids.push(u.instanceId);
    }
  }
  return ids;
}

/** Barracks whose center falls inside a screen drag box. */
export function barracksInScreenBox(
  state: BuildSimState,
  ownerId: string,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  camera: MapCamera,
  viewportRect: DOMRect,
  worldEl?: HTMLElement | null,
): string[] {
  const minSx = Math.min(x0, x1);
  const maxSx = Math.max(x0, x1);
  const minSy = Math.min(y0, y1);
  const maxSy = Math.max(y0, y1);
  const ids: string[] = [];

  for (const s of state.structures) {
    if (s.ownerId !== ownerId || s.defId !== "barracks") continue;
    if (s.buildProgress < 1 || s.hp <= 0) continue;
    const c = structureCenterPx(s);
    let sx: number;
    let sy: number;
    if (worldEl) {
      const pt = worldToClient(c.x, c.y, worldEl);
      sx = pt.clientX;
      sy = pt.clientY;
    } else {
      sx = (c.x - camera.x) * camera.zoom + viewportRect.left;
      sy = (c.y - camera.y) * camera.zoom + viewportRect.top;
    }
    if (sx >= minSx && sx <= maxSx && sy >= minSy && sy <= maxSy) {
      ids.push(s.instanceId);
    }
  }
  return ids;
}

export function applyMoveCommand(
  state: BuildSimState,
  unitIds: Set<string>,
  worldX: number,
  worldY: number,
): BuildSimState {
  return {
    ...state,
    units: issueMoveOrderSpread(state, state.units, unitIds, worldX, worldY),
  };
}

export function applyGatherCommand(
  state: BuildSimState,
  workerIds: Set<string>,
  generatorId: string,
  playerId: string = HUMAN_PLAYER_ID,
): BuildSimState {
  return issueWorkersGather(state, workerIds, generatorId, playerId);
}

export function applyAttackCommand(
  state: BuildSimState,
  unitIds: Set<string>,
  targetId: string,
  targetKind: TargetKind,
): BuildSimState {
  return {
    ...state,
    units: issueAttackOrder(state.units, unitIds, targetId, targetKind),
  };
}

export function applyProductionRallyCommand(
  state: BuildSimState,
  structureIds: readonly string[],
  worldX: number,
  worldY: number,
  playerId: string = HUMAN_PLAYER_ID,
): BuildSimState {
  return setProductionRallyPoint(state, structureIds, playerId, worldX, worldY);
}

export function worldFromClient(
  clientX: number,
  clientY: number,
  viewportRect: DOMRect,
  camera: MapCamera,
  worldEl?: HTMLElement | null,
): { worldX: number; worldY: number } {
  return clientToWorld(clientX, clientY, viewportRect, camera, worldEl);
}

export function worldHitRadiusForZoom(zoom: number): number {
  return UNIT_HIT_RADIUS_SCREEN_PX / Math.max(zoom, 0.25);
}

export interface DomPickResult {
  unitId: string | null;
  barracksId: string | null;
  hqSelected: boolean;
}

/** Prefer DOM hits (scaled with zoom); falls back to coordinate picking by caller. */
export function pickDomTarget(
  state: BuildSimState,
  target: EventTarget | null,
  humanId: string,
): DomPickResult {
  if (!(target instanceof HTMLElement)) {
    return { unitId: null, barracksId: null, hqSelected: false };
  }

  const unitEl = target.closest(".field-unit");
  if (unitEl instanceof HTMLElement) {
    const unitId = unitEl.dataset.unitId ?? null;
    const u = unitId ? state.units.find((x) => x.instanceId === unitId) : undefined;
    if (u && u.ownerId === humanId && u.hp > 0) {
      return { unitId, barracksId: null, hqSelected: false };
    }
  }

  const structEl = target.closest(".field-structure");
  if (structEl instanceof HTMLElement) {
    const id = structEl.dataset.instanceId ?? null;
    if (id) {
      const s = state.structures.find((x) => x.instanceId === id);
      if (
        s &&
        s.ownerId === humanId &&
        s.defId === "barracks" &&
        s.buildProgress >= 1 &&
        s.hp > 0
      ) {
        return { unitId: null, barracksId: id, hqSelected: false };
      }
      if (
        s &&
        s.ownerId === humanId &&
        s.defId === "hq" &&
        s.buildProgress >= 1 &&
        s.hp > 0
      ) {
        return { unitId: null, barracksId: null, hqSelected: true };
      }
    }
  }

  return { unitId: null, barracksId: null, hqSelected: false };
}

export function pickFriendlyGeneratorAt(
  state: BuildSimState,
  worldX: number,
  worldY: number,
  ownerId: string,
): string | null {
  for (const s of state.structures) {
    if (s.ownerId !== ownerId || (s.defId !== "generator" && s.defId !== "extractor")) continue;
    if (s.buildProgress < 1 || s.hp <= 0) continue;
    const def = structureDef(s.defId);
    const x0 = s.gx * CELL_PX;
    const y0 = s.gy * CELL_PX;
    const x1 = x0 + def.footprint.w * CELL_PX;
    const y1 = y0 + def.footprint.h * CELL_PX;
    if (worldX >= x0 && worldX <= x1 && worldY >= y0 && worldY <= y1) {
      return s.instanceId;
    }
  }
  return null;
}

export function selectedWorkerIds(
  state: BuildSimState,
  unitIds: Set<string>,
  ownerId: string,
): Set<string> {
  const out = new Set<string>();
  for (const id of unitIds) {
    const u = state.units.find((x) => x.instanceId === id);
    if (u && u.ownerId === ownerId && u.hp > 0 && isWorkerUnit(u.defId)) {
      out.add(id);
    }
  }
  return out;
}

export function pickFriendlyHqAt(
  state: BuildSimState,
  worldX: number,
  worldY: number,
  ownerId: string,
): string | null {
  for (const s of state.structures) {
    if (s.ownerId !== ownerId || s.defId !== "hq") continue;
    if (s.buildProgress < 1 || s.hp <= 0) continue;
    const def = structureDef(s.defId);
    const x0 = s.gx * CELL_PX;
    const y0 = s.gy * CELL_PX;
    const x1 = x0 + def.footprint.w * CELL_PX;
    const y1 = y0 + def.footprint.h * CELL_PX;
    if (worldX >= x0 && worldX <= x1 && worldY >= y0 && worldY <= y1) {
      return s.instanceId;
    }
  }
  return null;
}
