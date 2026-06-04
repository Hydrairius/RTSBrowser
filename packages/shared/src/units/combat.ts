import { CELL_PX, structureDef } from "../structures/defs.js";
import type { BuildSimState, PlacedStructure } from "../structures/building.js";
import { isCombatUnit, unitDef } from "./defs.js";
import { separateUnits, UNIT_COLLISION_RADIUS } from "./collision.js";
import { FLOW_SQUAD_MIN_UNITS, moveUnitWithFlow } from "./flow-navigation.js";
import { clearUnitNav, ensureUnitPath, moveUnitWithNav, navGoalKey } from "./navigation.js";
import { isEnemyVisibleToPlayer } from "../vision/vision.js";
import { distPx, isEnemy, moveToward, structureCenterPx, structureCombatReady, unitAlive } from "./geometry.js";
import type { Projectile, TargetKind, Unit, UnitOrder } from "./types.js";

export function getTargetCenter(
  state: BuildSimState,
  targetId: string,
  kind: TargetKind,
): { x: number; y: number } | null {
  if (kind === "unit") {
    const u = state.units.find((x) => x.instanceId === targetId && unitAlive(x));
    return u ? { x: u.x, y: u.y } : null;
  }
  const s = state.structures.find(
    (x) => x.instanceId === targetId && structureCombatReady(x),
  );
  return s ? structureCenterPx(s) : null;
}

export function findNearestEnemy(
  state: BuildSimState,
  ownerId: string,
  x: number,
  y: number,
  maxRangePx: number,
): { targetId: string; targetKind: TargetKind; dist: number } | null {
  let best: { targetId: string; targetKind: TargetKind; dist: number } | null = null;

  for (const u of state.units) {
    if (!unitAlive(u) || !isEnemy(ownerId, u.ownerId)) continue;
    if (
      state.vision &&
      !isEnemyVisibleToPlayer(state, ownerId, u.ownerId, u.instanceId, "unit")
    ) {
      continue;
    }
    const d = distPx(x, y, u.x, u.y);
    if (d > maxRangePx) continue;
    if (!best || d < best.dist) {
      best = { targetId: u.instanceId, targetKind: "unit", dist: d };
    }
  }

  for (const s of state.structures) {
    if (!structureCombatReady(s) || !isEnemy(ownerId, s.ownerId)) continue;
    if (
      state.vision &&
      !isEnemyVisibleToPlayer(state, ownerId, s.ownerId, s.instanceId, "structure")
    ) {
      continue;
    }
    const c = structureCenterPx(s);
    const d = distPx(x, y, c.x, c.y);
    if (d > maxRangePx) continue;
    if (!best || d < best.dist) {
      best = { targetId: s.instanceId, targetKind: "structure", dist: d };
    }
  }

  return best;
}

export function applyDamageToStructure(s: PlacedStructure, amount: number): PlacedStructure {
  return { ...s, hp: Math.max(0, s.hp - amount) };
}

export function applyDamageToUnit(u: Unit, amount: number): Unit {
  return { ...u, hp: Math.max(0, u.hp - amount) };
}

export function spawnProjectile(
  state: BuildSimState,
  ownerId: string,
  fromX: number,
  fromY: number,
  targetId: string,
  targetKind: TargetKind,
  damage: number,
  speed: number,
): BuildSimState {
  const id = `p-${state.nextProjectileId}`;
  return {
    ...state,
    projectiles: [
      ...state.projectiles,
      { id, ownerId, x: fromX, y: fromY, targetId, targetKind, damage, speed },
    ],
    nextProjectileId: state.nextProjectileId + 1,
  };
}

/** Pick nearest enemy in aggro range; used for idle/move auto-engage. */
export function findAggroTarget(
  state: BuildSimState,
  u: Unit,
  def: ReturnType<typeof unitDef>,
): { targetId: string; targetKind: TargetKind } | null {
  const near = findNearestEnemy(state, u.ownerId, u.x, u.y, def.aggroRadiusPx);
  if (!near) return null;
  return { targetId: near.targetId, targetKind: near.targetKind };
}

/** If not on attack order, acquire nearest enemy in aggro radius. */
function acquireAggroTarget(u: Unit, def: ReturnType<typeof unitDef>, target: { targetId: string; targetKind: TargetKind }): Unit {
  return clearUnitNav({
    ...u,
    order: { type: "attack", targetId: target.targetId, targetKind: target.targetKind },
  });
}

function chaseOrderTarget(state: BuildSimState, u: Unit, def: ReturnType<typeof unitDef>): Unit {
  if (u.order.type !== "attack") return u;
  const order = u.order;
  const center = getTargetCenter(state, order.targetId, order.targetKind);
  const targetOwner =
    order.targetKind === "unit"
      ? state.units.find((x) => x.instanceId === order.targetId)?.ownerId
      : state.structures.find((x) => x.instanceId === order.targetId)?.ownerId;
  if (
    !center ||
    (state.vision &&
      targetOwner &&
      !isEnemyVisibleToPlayer(
        state,
        u.ownerId,
        targetOwner,
        order.targetId,
        order.targetKind,
      ))
  ) {
    return { ...u, order: { type: "idle" as const } };
  }

  const inRange = distPx(u.x, u.y, center.x, center.y) <= def.attackRangePx;
  if (inRange) return u;

  const moved = moveUnitWithNav(state, u, center.x, center.y, def.moveSpeed);
  return moved.unit;
}

function tryStrike(
  state: BuildSimState,
  u: Unit,
): { state: BuildSimState; unit: Unit } {
  const def = unitDef(u.defId);
  if (u.attackCooldown > 0) {
    return { state, unit: { ...u, attackCooldown: u.attackCooldown - 1 } };
  }

  let targetId: string | null = null;
  let targetKind: TargetKind | null = null;
  let tx = 0;
  let ty = 0;

  if (u.order.type === "attack") {
    const order = u.order;
    const center = getTargetCenter(state, order.targetId, order.targetKind);
    const targetOwner =
      order.targetKind === "unit"
        ? state.units.find((x) => x.instanceId === order.targetId)?.ownerId
        : state.structures.find((x) => x.instanceId === order.targetId)?.ownerId;
    const visible =
      center &&
      (!state.vision ||
        !targetOwner ||
        isEnemyVisibleToPlayer(
          state,
          u.ownerId,
          targetOwner,
          order.targetId,
          order.targetKind,
        ));
    if (visible && center) {
      targetId = order.targetId;
      targetKind = order.targetKind;
      tx = center.x;
      ty = center.y;
    }
  } else if (u.order.type === "idle" || u.order.type === "move") {
    const scan = def.attackRangePx * 1.15;
    const near = findNearestEnemy(state, u.ownerId, u.x, u.y, scan);
    if (near) {
      targetId = near.targetId;
      targetKind = near.targetKind;
      const c = getTargetCenter(state, targetId, targetKind);
      if (c) {
        tx = c.x;
        ty = c.y;
      }
    }
  }

  if (!targetId || !targetKind) return { state, unit: u };

  if (distPx(u.x, u.y, tx, ty) > def.attackRangePx) {
    return { state, unit: u };
  }

  let nextState = state;
  let nextUnit: Unit = {
    ...u,
    attackCooldown: def.attackCooldownTicks,
    meleeSwingTicks: def.weapon === "melee" ? 4 : 0,
  };

  if (def.weapon === "ranged" && def.projectileSpeed) {
    nextState = spawnProjectile(
      nextState,
      u.ownerId,
      u.x,
      u.y,
      targetId,
      targetKind,
      def.damage,
      def.projectileSpeed,
    );
    return { state: nextState, unit: nextUnit };
  }

  if (targetKind === "unit") {
    const idx = nextState.units.findIndex((x) => x.instanceId === targetId);
    if (idx >= 0) {
      const units = [...nextState.units];
      units[idx] = applyDamageToUnit(units[idx]!, def.damage);
      nextState = { ...nextState, units };
    }
  } else {
    const idx = nextState.structures.findIndex((x) => x.instanceId === targetId);
    if (idx >= 0) {
      const structures = [...nextState.structures];
      structures[idx] = applyDamageToStructure(structures[idx]!, def.damage);
      nextState = { ...nextState, structures };
    }
  }

  return { state: nextState, unit: nextUnit };
}

function patchUnitInState(state: BuildSimState, unit: Unit): BuildSimState {
  const idx = state.units.findIndex((x) => x.instanceId === unit.instanceId);
  if (idx < 0) return state;
  const units = [...state.units];
  units[idx] = unit;
  return { ...state, units };
}

/**
 * Advance each living unit once per tick.
 * Must not rebuild the units array from map() returns — tryStrike mutates other
 * units (damage) on `state` while returning only the attacker's Unit snapshot.
 */
export function advanceUnitCombat(state: BuildSimState): BuildSimState {
  let next = state;

  for (const u of [...next.units]) {
    if (!unitAlive(u) || !isCombatUnit(u.defId)) continue;
    const def = unitDef(u.defId);
    let cur = next.units.find((x) => x.instanceId === u.instanceId) ?? u;
    if (!unitAlive(cur)) continue;

    if (cur.meleeSwingTicks > 0) {
      cur = { ...cur, meleeSwingTicks: cur.meleeSwingTicks - 1 };
      next = patchUnitInState(next, cur);
    }

    if (cur.order.type !== "attack") {
      const aggro = findAggroTarget(next, cur, def);
      if (aggro) {
        cur = acquireAggroTarget(cur, def, aggro);
        next = patchUnitInState(next, cur);
      }
    }

    if (cur.order.type === "move") {
      if (cur.navUseFlow) {
        const flow = moveUnitWithFlow(
          next,
          cur,
          cur.order.x,
          cur.order.y,
          def.moveSpeed,
        );
        next = flow.state;
        cur = {
          ...flow.unit,
          order: flow.arrived ? { type: "idle" } : cur.order,
        };
      } else {
        const moved = moveUnitWithNav(
          next,
          cur,
          cur.order.x,
          cur.order.y,
          def.moveSpeed,
        );
        cur = {
          ...moved.unit,
          order: moved.arrived ? { type: "idle" } : cur.order,
        };
      }
      next = patchUnitInState(next, cur);
      continue;
    }

    if (cur.order.type === "attack") {
      cur = chaseOrderTarget(next, cur, def);
      next = patchUnitInState(next, cur);
      if (cur.order.type === "idle") continue;
    }

    const strike = tryStrike(next, cur);
    next = strike.state;
    next = patchUnitInState(next, strike.unit);
  }

  return separateUnits(next);
}

export function advanceProjectiles(state: BuildSimState): BuildSimState {
  if (state.projectiles.length === 0) return state;

  const remaining: Projectile[] = [];
  const impacts: Projectile[] = [];
  let units = state.units;
  let structures = state.structures;

  for (const p of state.projectiles) {
    const center = getTargetCenter(
      { ...state, units, structures },
      p.targetId,
      p.targetKind,
    );
    if (!center) continue;

    const moved = moveToward(p.x, p.y, center.x, center.y, p.speed);
    if (!moved.arrived) {
      remaining.push({ ...p, x: moved.x, y: moved.y });
      continue;
    }
    impacts.push(p);
  }

  // Apply all impacts in one pass so simultaneous hits don't erase each other.
  for (const p of impacts) {
    if (p.targetKind === "unit") {
      const idx = units.findIndex((u) => u.instanceId === p.targetId);
      if (idx < 0) continue;
      units = [...units];
      units[idx] = applyDamageToUnit(units[idx]!, p.damage);
    } else {
      const idx = structures.findIndex((s) => s.instanceId === p.targetId);
      if (idx < 0) continue;
      structures = [...structures];
      structures[idx] = applyDamageToStructure(structures[idx]!, p.damage);
    }
  }

  return { ...state, projectiles: remaining, units, structures };
}

export function pruneDead(state: BuildSimState): BuildSimState {
  return {
    ...state,
    units: state.units.filter((u) => u.hp > 0),
    structures: state.structures.filter(
      (s) => s.buildProgress < 1 || s.hp > 0,
    ),
  };
}

/** Spawn offset near barracks center. */
export function barracksSpawnPoint(s: PlacedStructure): { x: number; y: number } {
  const c = structureCenterPx(s);
  const def = structureDef(s.defId);
  return {
    x: c.x + def.footprint.w * CELL_PX * 0.35,
    y: c.y + CELL_PX * 0.5,
  };
}

/** Spawn just outside HQ footprint (not inside the blocking 2×2 core). */
export function hqSpawnPoint(s: PlacedStructure, slot = 0): { x: number; y: number } {
  const def = structureDef(s.defId);
  const c = structureCenterPx(s);
  const lane = (slot % 3) - 1;
  return {
    x: c.x + lane * CELL_PX * 0.45,
    y: (s.gy + def.footprint.h) * CELL_PX + CELL_PX * 0.35,
  };
}

export function issueMoveOrder(
  state: BuildSimState,
  units: Unit[],
  ids: Set<string>,
  x: number,
  y: number,
): Unit[] {
  const useFlow = ids.size >= FLOW_SQUAD_MIN_UNITS;
  return units.map((u) => {
    if (!ids.has(u.instanceId)) return u;
    const base = clearUnitNav({
      ...u,
      order: { type: "move", x, y },
    });
    const withOrder = {
      ...base,
      navUseFlow: useFlow,
      navGoalKey: useFlow ? navGoalKey(x, y) : undefined,
      navFlowGoal: useFlow ? { x, y } : undefined,
    };
    if (useFlow) return withOrder;
    return ensureUnitPath(state, withOrder, x, y);
  });
}

/** Spread move targets so a squad does not stack on one pixel. */
export function moveDestinationsForGroup(
  centerX: number,
  centerY: number,
  unitIds: string[],
): Map<string, { x: number; y: number }> {
  const out = new Map<string, { x: number; y: number }>();
  const spacing = UNIT_COLLISION_RADIUS * 2 * 1.15;
  const ids = unitIds;
  if (ids.length === 0) return out;
  if (ids.length === 1) {
    out.set(ids[0]!, { x: centerX, y: centerY });
    return out;
  }
  ids.forEach((id, i) => {
    const ring = Math.floor(i / 8) + 1;
    const slot = i % 8;
    const angle = (slot / 8) * Math.PI * 2 + ring * 0.35;
    const r = spacing * ring;
    out.set(id, {
      x: centerX + Math.cos(angle) * r,
      y: centerY + Math.sin(angle) * r,
    });
  });
  return out;
}

export function issueMoveOrderSpread(
  state: BuildSimState,
  units: Unit[],
  ids: Set<string>,
  centerX: number,
  centerY: number,
): Unit[] {
  const dests = moveDestinationsForGroup(centerX, centerY, [...ids]);
  const useFlow = ids.size >= FLOW_SQUAD_MIN_UNITS;
  const sharedGoalKey = useFlow ? navGoalKey(centerX, centerY) : undefined;
  return units.map((u) => {
    if (!ids.has(u.instanceId)) return u;
    const d = dests.get(u.instanceId) ?? { x: centerX, y: centerY };
    const base = clearUnitNav({
      ...u,
      order: { type: "move", x: d.x, y: d.y },
    });
    const withOrder = {
      ...base,
      navUseFlow: useFlow,
      navGoalKey: useFlow ? sharedGoalKey : undefined,
      navFlowGoal: useFlow ? { x: centerX, y: centerY } : undefined,
    };
    if (useFlow) return withOrder;
    return ensureUnitPath(state, withOrder, d.x, d.y);
  });
}

export function issueAttackOrder(
  units: Unit[],
  ids: Set<string>,
  targetId: string,
  targetKind: TargetKind,
): Unit[] {
  const order: UnitOrder = { type: "attack", targetId, targetKind };
  return units.map((u) => (ids.has(u.instanceId) ? clearUnitNav({ ...u, order }) : u));
}

/** Cancel movement, combat chase, and worker jobs; hold position. */
export function issueStopOrder(units: Unit[], ids: Set<string>): Unit[] {
  return units.map((u) =>
    ids.has(u.instanceId) && u.hp > 0
      ? clearUnitNav({ ...u, order: { type: "idle" } })
      : u,
  );
}
