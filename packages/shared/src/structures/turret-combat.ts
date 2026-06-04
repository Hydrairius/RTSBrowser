import type { BuildSimState, PlacedStructure } from "./building.js";
import { structureDef, type StructureDefId } from "./defs.js";
import {
  findNearestEnemy,
  getTargetCenter,
  spawnProjectile,
} from "../units/combat.js";
import { structureCenterPx, structureCombatReady } from "../units/geometry.js";

const TURRET_ID: StructureDefId = "turret";

function turretCombatDef(s: PlacedStructure) {
  const def = structureDef(s.defId);
  if (
    def.id !== TURRET_ID ||
    def.turretRangePx == null ||
    def.turretDamage == null ||
    def.turretCooldownTicks == null ||
    def.turretProjectileSpeed == null
  ) {
    return null;
  }
  return def;
}

/** Defensive structures that auto-fire at enemies in range. */
export function advanceStructureTurrets(state: BuildSimState): BuildSimState {
  let next = state;
  const structures = [...state.structures];
  let structChanged = false;

  for (let i = 0; i < structures.length; i++) {
    const s = structures[i]!;
    if (!structureCombatReady(s)) continue;
    const def = turretCombatDef(s);
    if (!def) continue;

    let cooldown = s.attackCooldown ?? 0;
    if (cooldown > 0) {
      structures[i] = { ...s, attackCooldown: cooldown - 1 };
      structChanged = true;
      continue;
    }

    const center = structureCenterPx(s);
    const near = findNearestEnemy(
      next,
      s.ownerId,
      center.x,
      center.y,
      def.turretRangePx!,
    );
    if (!near) continue;

    const targetCenter = getTargetCenter(next, near.targetId, near.targetKind);
    if (!targetCenter) continue;

    next = spawnProjectile(
      next,
      s.ownerId,
      center.x,
      center.y,
      near.targetId,
      near.targetKind,
      def.turretDamage!,
      def.turretProjectileSpeed!,
    );
    structures[i] = { ...s, attackCooldown: def.turretCooldownTicks! };
    structChanged = true;
  }

  if (!structChanged) return next;
  return { ...next, structures };
}
