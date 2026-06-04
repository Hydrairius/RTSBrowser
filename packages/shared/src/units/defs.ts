/** v0 unit roster — melee striker and ranged bolter. */

import { CELL_PX } from "../structures/defs.js";

export type UnitDefId = "striker" | "bolter" | "worker";

export interface UnitDef {
  id: UnitDefId;
  displayName: string;
  /** Training cost in matter. */
  cost: number;
  /** Ticks to train at a barracks. */
  trainTicks: number;
  maxHp: number;
  /** Damage per attack. */
  damage: number;
  /** Attack cooldown in simulation ticks. */
  attackCooldownTicks: number;
  /** World pixels moved per tick. */
  moveSpeed: number;
  /** Attack range in world pixels (center to center). */
  attackRangePx: number;
  /** Auto-attack enemies within this radius (center to center). */
  aggroRadiusPx: number;
  /** Ranged units fire a projectile; melee strikes in place. */
  weapon: "melee" | "ranged";
  /** Projectile travel speed (px/tick); melee ignores. */
  projectileSpeed?: number;
}

export const UNIT_DEFS: UnitDef[] = [
  {
    id: "worker",
    displayName: "Worker",
    cost: 30,
    trainTicks: 18,
    maxHp: 50,
    damage: 0,
    attackCooldownTicks: 999,
    moveSpeed: 5,
    attackRangePx: 0,
    aggroRadiusPx: 0,
    weapon: "melee",
  },
  {
    id: "striker",
    displayName: "Striker",
    cost: 25,
    trainTicks: 20,
    maxHp: 80,
    damage: 14,
    attackCooldownTicks: 8,
    moveSpeed: 5,
    /** Slightly over one cell so edge stops still connect after chase. */
    attackRangePx: CELL_PX * 1.35,
    aggroRadiusPx: CELL_PX * 3.5,
    weapon: "melee",
  },
  {
    id: "bolter",
    displayName: "Bolter",
    cost: 35,
    trainTicks: 25,
    maxHp: 55,
    damage: 10,
    attackCooldownTicks: 12,
    moveSpeed: 4,
    attackRangePx: CELL_PX * 6,
    aggroRadiusPx: CELL_PX * 10,
    weapon: "ranged",
    projectileSpeed: 14,
  },
];

const unitMap = new Map(UNIT_DEFS.map((d) => [d.id, d]));

export function unitDef(id: UnitDefId): UnitDef {
  const d = unitMap.get(id);
  if (!d) throw new Error(`Unknown unit: ${id}`);
  return d;
}

export const TRAINABLE_UNIT_IDS: UnitDefId[] = ["striker", "bolter"];

export const HQ_TRAINABLE_UNIT_IDS: UnitDefId[] = ["worker"];

export function isWorkerUnit(defId: UnitDefId): boolean {
  return defId === "worker";
}

export function isCombatUnit(defId: UnitDefId): boolean {
  return !isWorkerUnit(defId);
}
