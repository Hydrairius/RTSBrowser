import { CELL_PX, structureDef } from "../structures/defs.js";
import type { BuildSimState, PlacedStructure } from "../structures/building.js";
import { remainingMatterForGenerator } from "../map/matter-deposits.js";
import { unitDef, isWorkerUnit } from "./defs.js";
import { separateUnits, UNIT_COLLISION_RADIUS } from "./collision.js";
import { moveDestinationsForGroup } from "./combat.js";
import { distPx, structureCenterPx, structureCombatReady, unitAlive } from "./geometry.js";
import { clearUnitNav, moveUnitWithNav } from "./navigation.js";
import type { Unit } from "./types.js";

/** Workers must be this close to a site center to contribute build progress. */
export const WORKER_BUILD_RANGE_PX = CELL_PX * 2.25;

/** Cap workers counted per structure (diminishing returns avoided). */
export const MAX_WORKERS_PER_SITE = 6;

/** Max workers operating one generator. */
export const MAX_GENERATOR_WORKERS = 2;

export function countPlayerWorkers(state: BuildSimState, playerId: string): number {
  return state.units.filter((u) => u.ownerId === playerId && isWorkerUnit(u.defId) && unitAlive(u))
    .length;
}

export function incompleteStructuresForPlayer(
  state: BuildSimState,
  playerId: string,
): PlacedStructure[] {
  return state.structures.filter(
    (s) => s.ownerId === playerId && s.buildProgress < 1 && s.defId !== "hq",
  );
}

function isOperatingGenerator(s: PlacedStructure): boolean {
  return s.defId === "generator" && structureCombatReady(s) && remainingMatterForGenerator(s) > 0;
}

function workerAtStructureCenter(u: Unit, site: PlacedStructure): boolean {
  const c = structureCenterPx(site);
  return distPx(u.x, u.y, c.x, c.y) <= WORKER_BUILD_RANGE_PX;
}

/** Walk target beside the footprint — not inside completed-structure collision. */
export function structureBuildApproachPx(site: PlacedStructure): { x: number; y: number } {
  const c = structureCenterPx(site);
  const def = structureDef(site.defId);
  return {
    x: c.x,
    y: (site.gy + def.footprint.h) * CELL_PX + UNIT_COLLISION_RADIUS * 1.1,
  };
}

/** Stand west of a 1×1 generator (visible “at the machine”). */
export function structureGeneratorApproachPx(site: PlacedStructure): { x: number; y: number } {
  const c = structureCenterPx(site);
  const def = structureDef(site.defId);
  return {
    x: site.gx * CELL_PX - UNIT_COLLISION_RADIUS * 1.1,
    y: c.y + (def.footprint.h * CELL_PX) * 0.1,
  };
}

export function workersAtStructure(state: BuildSimState, structureId: string): number {
  const site = state.structures.find((s) => s.instanceId === structureId);
  if (!site || site.buildProgress >= 1) return 0;

  let n = 0;
  for (const u of state.units) {
    if (!unitAlive(u) || !isWorkerUnit(u.defId) || u.ownerId !== site.ownerId) continue;
    if (u.order.type === "construct" && u.order.structureId === structureId) {
      if (workerAtStructureCenter(u, site)) n++;
      continue;
    }
    if (u.order.type === "idle" && workerAtStructureCenter(u, site)) n++;
  }
  return Math.min(n, MAX_WORKERS_PER_SITE);
}

/** Worker is in range and contributing build progress this tick. */
export function workerActivelyBuilding(state: BuildSimState, u: Unit): boolean {
  if (!unitAlive(u) || !isWorkerUnit(u.defId)) return false;

  if (u.order.type === "construct") {
    const structureId = u.order.structureId;
    const site = state.structures.find((s) => s.instanceId === structureId);
    if (
      site &&
      site.buildProgress < 1 &&
      site.ownerId === u.ownerId &&
      workerAtStructureCenter(u, site)
    ) {
      return true;
    }
  }

  if (u.order.type === "idle") {
    for (const site of state.structures) {
      if (
        site.ownerId === u.ownerId &&
        site.buildProgress < 1 &&
        workerAtStructureCenter(u, site)
      ) {
        return true;
      }
    }
  }

  return false;
}

/** Workers assigned to gather (en route or on site) — used for the 2-worker cap. */
export function workersAssignedToGenerator(
  state: BuildSimState,
  structureId: string,
): number {
  const site = state.structures.find((s) => s.instanceId === structureId);
  if (!site || !isOperatingGenerator(site)) return 0;

  let n = 0;
  for (const u of state.units) {
    if (!unitAlive(u) || !isWorkerUnit(u.defId) || u.ownerId !== site.ownerId) continue;
    if (u.order.type === "gather" && u.order.structureId === structureId) n++;
  }
  return n;
}

/** Workers in range and gathering — produces matter this tick. */
export function workersOperatingGenerator(
  state: BuildSimState,
  structureId: string,
): number {
  const site = state.structures.find((s) => s.instanceId === structureId);
  if (!site || !isOperatingGenerator(site)) return 0;

  let n = 0;
  for (const u of state.units) {
    if (!unitAlive(u) || !isWorkerUnit(u.defId) || u.ownerId !== site.ownerId) continue;
    if (u.order.type === "gather" && u.order.structureId === structureId) {
      if (workerAtStructureCenter(u, site)) n++;
    }
  }
  return Math.min(n, MAX_GENERATOR_WORKERS);
}

export function canAssignWorkerToGenerator(
  state: BuildSimState,
  generatorId: string,
  playerId: string,
): boolean {
  const s = state.structures.find((x) => x.instanceId === generatorId);
  if (!s || s.ownerId !== playerId || !isOperatingGenerator(s)) return false;
  return workersAssignedToGenerator(state, generatorId) < MAX_GENERATOR_WORKERS;
}

/** Assign idle workers to gather at a generator (respects 2-worker cap). */
export function issueWorkersGather(
  state: BuildSimState,
  workerIds: Iterable<string>,
  generatorId: string,
  playerId: string,
): BuildSimState {
  const s = state.structures.find((x) => x.instanceId === generatorId);
  if (!s || s.ownerId !== playerId || !isOperatingGenerator(s)) return state;

  let slots = MAX_GENERATOR_WORKERS - workersAssignedToGenerator(state, generatorId);
  if (slots <= 0) return state;

  const idSet = new Set(workerIds);
  const units = state.units.map((u) => {
    if (!idSet.has(u.instanceId) || slots <= 0) return u;
    if (!unitAlive(u) || !isWorkerUnit(u.defId) || u.ownerId !== playerId) return u;
    slots--;
    return clearUnitNav({
      ...u,
      order: { type: "gather", structureId: generatorId },
    });
  });

  return { ...state, units };
}

function nearestIncompleteSite(
  state: BuildSimState,
  worker: Unit,
): PlacedStructure | null {
  const sites = incompleteStructuresForPlayer(state, worker.ownerId);
  if (sites.length === 0) return null;

  let best: PlacedStructure | null = null;
  let bestD = Infinity;
  for (const s of sites) {
    const goal = structureBuildApproachPx(s);
    const d = distPx(worker.x, worker.y, goal.x, goal.y);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  return best;
}

function nearestGeneratorNeedingWorkers(
  state: BuildSimState,
  worker: Unit,
): PlacedStructure | null {
  let best: PlacedStructure | null = null;
  let bestScore = -Infinity;

  for (const s of state.structures) {
    if (!isOperatingGenerator(s) || s.ownerId !== worker.ownerId) continue;
    const assigned = workersAssignedToGenerator(state, s.instanceId);
    if (assigned >= MAX_GENERATOR_WORKERS) continue;
    const slots = MAX_GENERATOR_WORKERS - assigned;
    const goal = structureGeneratorApproachPx(s);
    const d = distPx(worker.x, worker.y, goal.x, goal.y);
    const score = slots * 1e6 - d;
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return best;
}

function assignConstructOrder(u: Unit, structureId: string): Unit {
  return clearUnitNav({
    ...u,
    order: { type: "construct", structureId },
  });
}

function assignGatherOrder(u: Unit, structureId: string): Unit {
  return clearUnitNav({
    ...u,
    order: { type: "gather", structureId },
  });
}

type StructureWorkerTask = "construct" | "gather";

/** Workers sharing a build/gather site otherwise path to one pixel and jam. */
function workerIdsForStructureTask(
  state: BuildSimState,
  structureId: string,
  task: StructureWorkerTask,
  alwaysIncludeId?: string,
): string[] {
  const ids = new Set<string>();
  for (const u of state.units) {
    if (!unitAlive(u) || !isWorkerUnit(u.defId)) continue;
    if (u.order.type === task && u.order.structureId === structureId) {
      ids.add(u.instanceId);
    }
  }
  if (alwaysIncludeId) ids.add(alwaysIncludeId);
  return [...ids].sort();
}

function workerSpreadGoal(
  state: BuildSimState,
  worker: Unit,
  base: { x: number; y: number },
  structureId: string,
  task: StructureWorkerTask,
): { x: number; y: number } {
  const ids = workerIdsForStructureTask(state, structureId, task, worker.instanceId);
  const dests = moveDestinationsForGroup(base.x, base.y, ids);
  return dests.get(worker.instanceId) ?? base;
}

function moveWorkerToward(
  state: BuildSimState,
  u: Unit,
  tx: number,
  ty: number,
): { state: BuildSimState; unit: Unit } {
  const def = unitDef(u.defId);
  const moved = moveUnitWithNav(state, u, tx, ty, def.moveSpeed);
  let unit = moved.unit;
  if (moved.arrived && unit.order.type === "move") {
    unit = clearUnitNav({ ...unit, order: { type: "idle" } });
  }
  return { state, unit };
}

function patchUnit(state: BuildSimState, unit: Unit): BuildSimState {
  const idx = state.units.findIndex((x) => x.instanceId === unit.instanceId);
  if (idx < 0) return state;
  const units = [...state.units];
  units[idx] = unit;
  return { ...state, units };
}

function applyGeneratorIncome(state: BuildSimState): BuildSimState {
  const players = new Map(state.players);
  const structures = state.structures.map((s) => ({ ...s }));

  for (const s of structures) {
    if (!isOperatingGenerator(s)) continue;
    const def = structureDef("generator");
    const rate = def.incomePerTick ?? 0;
    if (rate <= 0) continue;

    const crew = workersOperatingGenerator(state, s.instanceId);
    if (crew <= 0) continue;

    const owner = players.get(s.ownerId);
    if (!owner) continue;
    const available = remainingMatterForGenerator(s);
    const gained = Math.min(available, rate * crew);
    if (gained <= 0) continue;
    s.matterRemaining = available - gained;
    players.set(s.ownerId, {
      ...owner,
      matter: owner.matter + gained,
    });
  }

  return { ...state, players, structures };
}

/** Workers build structures, gather at generators, and move on player orders. */
export function advanceWorkerConstruction(state: BuildSimState): BuildSimState {
  let next = state;

  for (const u of [...next.units]) {
    if (!unitAlive(u) || !isWorkerUnit(u.defId)) continue;

    let cur = next.units.find((x) => x.instanceId === u.instanceId) ?? u;

    if (cur.order.type === "attack") continue;

    if (cur.order.type === "move") {
      const moved = moveWorkerToward(next, cur, cur.order.x, cur.order.y);
      next = patchUnit(moved.state, moved.unit);
      continue;
    }

    if (cur.order.type === "gather") {
      const structureId = cur.order.structureId;
      const gen = next.structures.find((s) => s.instanceId === structureId);
      if (!gen || !isOperatingGenerator(gen) || gen.ownerId !== cur.ownerId) {
        cur = { ...cur, order: { type: "idle" } };
        next = patchUnit(next, cur);
        continue;
      }
      if (workersAssignedToGenerator(next, structureId) > MAX_GENERATOR_WORKERS) {
        cur = { ...cur, order: { type: "idle" } };
        next = patchUnit(next, cur);
        continue;
      }
      const base = structureGeneratorApproachPx(gen);
      const goal = workerSpreadGoal(next, cur, base, structureId, "gather");
      if (!workerAtStructureCenter(cur, gen)) {
        const moved = moveWorkerToward(next, cur, goal.x, goal.y);
        next = patchUnit(moved.state, moved.unit);
      }
      continue;
    }

    if (cur.order.type === "construct") {
      const structureId = cur.order.structureId;
      const site = next.structures.find((s) => s.instanceId === structureId);
      if (!site || site.buildProgress >= 1 || site.ownerId !== cur.ownerId) {
        cur = { ...cur, order: { type: "idle" } };
        next = patchUnit(next, cur);
        continue;
      }
      const base = structureBuildApproachPx(site);
      const goal = workerSpreadGoal(next, cur, base, structureId, "construct");
      if (!workerAtStructureCenter(cur, site)) {
        const moved = moveWorkerToward(next, cur, goal.x, goal.y);
        next = patchUnit(moved.state, moved.unit);
      }
      continue;
    }

    const site = nearestIncompleteSite(next, cur);
    if (site) {
      cur = assignConstructOrder(cur, site.instanceId);
      const base = structureBuildApproachPx(site);
      const goal = workerSpreadGoal(next, cur, base, site.instanceId, "construct");
      if (!workerAtStructureCenter(cur, site)) {
        const moved = moveWorkerToward(next, cur, goal.x, goal.y);
        cur = moved.unit;
      }
      next = patchUnit(next, cur);
      continue;
    }

    const gen = nearestGeneratorNeedingWorkers(next, cur);
    if (gen) {
      cur = assignGatherOrder(cur, gen.instanceId);
      const base = structureGeneratorApproachPx(gen);
      const goal = workerSpreadGoal(next, cur, base, gen.instanceId, "gather");
      if (!workerAtStructureCenter(cur, gen)) {
        const moved = moveWorkerToward(next, cur, goal.x, goal.y);
        cur = moved.unit;
      }
      next = patchUnit(next, cur);
    }
  }

  next = separateUnits(next);

  const structures = next.structures.map((s) => ({ ...s }));

  for (const s of structures) {
    if (s.buildProgress >= 1) continue;
    const def = structureDef(s.defId);
    if (def.buildTimeTicks <= 0) continue;

    const crew = workersAtStructure(next, s.instanceId);
    if (crew <= 0) continue;

    const step = (1 / def.buildTimeTicks) * crew;
    const prev = s.buildProgress;
    s.buildProgress = Math.min(1, s.buildProgress + step);
    if (prev < 1 && s.buildProgress >= 1) {
      s.hp = s.maxHp;
    }
  }

  next = { ...next, structures };
  next = applyGeneratorIncome(next);
  return next;
}
