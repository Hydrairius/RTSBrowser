import { CELL_PX, structureDef, type StructureDefId } from "../structures/defs.js";
import type { PlacedStructure } from "../structures/building.js";
import type { Unit } from "./types.js";

export function structureCenterPx(s: PlacedStructure): { x: number; y: number } {
  const def = structureDef(s.defId);
  return {
    x: (s.gx + def.footprint.w / 2) * CELL_PX,
    y: (s.gy + def.footprint.h / 2) * CELL_PX,
  };
}

export function structureMaxHp(defId: StructureDefId): number {
  switch (defId) {
    case "hq":
      return 800;
    case "barracks":
      return 450;
    case "generator":
      return 200;
    case "turret":
      return 300;
    default:
      return 100;
  }
}

export function distPx(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}

export function moveToward(
  x: number,
  y: number,
  tx: number,
  ty: number,
  speed: number,
): { x: number; y: number; arrived: boolean } {
  const d = distPx(x, y, tx, ty);
  if (d <= speed || d < 0.001) {
    return { x: tx, y: ty, arrived: true };
  }
  const f = speed / d;
  return { x: x + (tx - x) * f, y: y + (ty - y) * f, arrived: false };
}

export function isEnemy(ownerA: string, ownerB: string): boolean {
  return ownerA !== ownerB;
}

export function unitAlive(u: Unit): boolean {
  return u.hp > 0;
}

export function structureCombatReady(s: PlacedStructure): boolean {
  return s.buildProgress >= 1 && s.hp > 0;
}
