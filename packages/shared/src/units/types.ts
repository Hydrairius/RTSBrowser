import type { UnitDefId } from "./defs.js";

export type TargetKind = "unit" | "structure";

export type UnitOrder =
  | { type: "idle" }
  | { type: "move"; x: number; y: number }
  | { type: "attack"; targetId: string; targetKind: TargetKind }
  | { type: "construct"; structureId: string }
  | { type: "gather"; structureId: string };

export interface Unit {
  instanceId: string;
  defId: UnitDefId;
  ownerId: string;
  /** World pixel center. */
  x: number;
  y: number;
  hp: number;
  order: UnitOrder;
  attackCooldown: number;
  /** Ticks remaining for melee strike VFX. */
  meleeSwingTicks: number;
  /** Baked A* route around walls; cleared on idle or new orders. */
  navWaypoints?: readonly { x: number; y: number }[];
  navWaypointIndex?: number;
  /** Goal cell key — path recomputed when this changes. */
  navGoalKey?: string;
  /** Squad move: sample shared flow field instead of per-unit A*. */
  navUseFlow?: boolean;
}

export interface Projectile {
  id: string;
  ownerId: string;
  x: number;
  y: number;
  targetId: string;
  targetKind: TargetKind;
  damage: number;
  speed: number;
}

export interface BarracksProduction {
  unitDefId: UnitDefId;
  /** 0–1 progress for current train job. */
  progress: number;
}
