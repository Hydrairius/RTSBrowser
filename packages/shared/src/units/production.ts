import { aiShouldTrainUnits } from "../ai/policy.js";
import type { BuildSimState, PlacedStructure } from "../structures/building.js";
import { getPlayerHq } from "../structures/building.js";
import { countPlayerWorkers, incompleteStructuresForPlayer } from "./construction.js";
import { unitDef, isWorkerUnit, type UnitDefId } from "./defs.js";
import { barracksSpawnPoint, hqSpawnPoint, issueMoveOrder } from "./combat.js";
import { findSpawnPosition } from "./collision.js";
import { structureCombatReady } from "./geometry.js";
import type { BarracksProduction, Unit } from "./types.js";

/** AI queues a train job at most this often (build ticks). */
export const AI_TRAIN_INTERVAL_TICKS = 25;

/** Max units waiting + training per barracks. */
export const BARRACKS_QUEUE_MAX = 15;

/** Max workers queued at HQ. */
export const HQ_QUEUE_MAX = 5;

/** Workers spawned at match start per player. */
export const STARTING_WORKERS = 2;

/** Max living units per player (workers + combat). */
export const PLAYER_UNIT_CAP = 100;

export function canTrainAtBarracks(
  state: BuildSimState,
  barracksId: string,
  playerId: string,
  unitDefId: UnitDefId,
): boolean {
  const s = state.structures.find((x) => x.instanceId === barracksId);
  if (!s || s.ownerId !== playerId || s.defId !== "barracks") return false;
  if (!structureCombatReady(s)) return false;
  if (s.trainQueue.length >= BARRACKS_QUEUE_MAX) return false;
  if (playerAtUnitCap(state, playerId)) return false;
  const player = state.players.get(playerId);
  if (!player) return false;
  const def = unitDef(unitDefId);
  return player.matter >= def.cost;
}

export function queueTrainAtBarracks(
  state: BuildSimState,
  barracksId: string,
  playerId: string,
  unitDefId: UnitDefId,
): BuildSimState | null {
  if (!canTrainAtBarracks(state, barracksId, playerId, unitDefId)) return null;

  const def = unitDef(unitDefId);
  const player = state.players.get(playerId)!;
  const players = new Map(state.players);
  players.set(playerId, { ...player, matter: player.matter - def.cost });

  const structures = state.structures.map((s) => {
    if (s.instanceId !== barracksId) return s;
    const entry: BarracksProduction = { unitDefId, progress: 0 };
    return { ...s, trainQueue: [...s.trainQueue, entry] };
  });

  return { ...state, players, structures };
}

function spawnUnit(
  state: BuildSimState,
  ownerId: string,
  unitDefId: UnitDefId,
  x: number,
  y: number,
  rallyPoint?: { x: number; y: number },
): BuildSimState {
  if (playerAtUnitCap(state, ownerId)) return state;
  const def = unitDef(unitDefId);
  const unit: Unit = {
    instanceId: `u-${state.nextUnitId}`,
    defId: unitDefId,
    ownerId,
    x,
    y,
    hp: def.maxHp,
    order: { type: "idle" },
    attackCooldown: 0,
    meleeSwingTicks: 0,
  };
  let next: BuildSimState = {
    ...state,
    units: [...state.units, unit],
    nextUnitId: state.nextUnitId + 1,
  };
  if (rallyPoint) {
    next = {
      ...next,
      units: issueMoveOrder(next, next.units, new Set([unit.instanceId]), rallyPoint.x, rallyPoint.y),
    };
  }
  return next;
}

/** Set rally point on HQ and/or barracks owned by the player. */
export function setProductionRallyPoint(
  state: BuildSimState,
  structureIds: readonly string[],
  playerId: string,
  x: number,
  y: number,
): BuildSimState {
  const idSet = new Set(structureIds);
  const structures = state.structures.map((s) => {
    if (!idSet.has(s.instanceId) || s.ownerId !== playerId) return s;
    if (s.defId !== "hq" && s.defId !== "barracks") return s;
    if (!structureCombatReady(s)) return s;
    return { ...s, rallyPoint: { x, y } };
  });
  return { ...state, structures };
}

export function advanceBarracksProduction(state: BuildSimState): BuildSimState {
  let next = state;
  const structures = next.structures.map((s) => {
    if (s.defId !== "barracks" || s.trainQueue.length === 0 || !structureCombatReady(s)) {
      return s;
    }

    const head = s.trainQueue[0]!;
    const def = unitDef(head.unitDefId);
    const step = def.trainTicks > 0 ? 1 / def.trainTicks : 1;
    const progress = Math.min(1, head.progress + step);

    if (progress < 1) {
      const queue = [{ ...head, progress }, ...s.trainQueue.slice(1)];
      return { ...s, trainQueue: queue };
    }

    if (playerAtUnitCap(next, s.ownerId)) {
      return { ...s, trainQueue: [{ ...head, progress: 1 }, ...s.trainQueue.slice(1)] };
    }

    const preferred = barracksSpawnPoint(s);
    const spawn = findSpawnPosition(next, preferred.x, preferred.y);
    next = spawnUnit(next, s.ownerId, head.unitDefId, spawn.x, spawn.y, s.rallyPoint);
    return { ...s, trainQueue: s.trainQueue.slice(1) };
  });

  return { ...next, structures };
}

export function findPlayerBarracksReady(
  state: BuildSimState,
  playerId: string,
): PlacedStructure | undefined {
  return state.structures.find(
    (s) =>
      s.ownerId === playerId &&
      s.defId === "barracks" &&
      structureCombatReady(s) &&
      s.trainQueue.length < BARRACKS_QUEUE_MAX,
  );
}

/** AI: pick a barracks and unit type to train this tick. */
export function aiTrainDecision(
  state: BuildSimState,
  playerId: string,
): { barracksId: string; unitDefId: UnitDefId } | null {
  const player = state.players.get(playerId);
  if (!player) return null;
  if (!aiShouldTrainUnits(state, playerId, state.tick)) return null;

  const barracks = state.structures
    .filter(
      (s) =>
        s.ownerId === playerId &&
        s.defId === "barracks" &&
        structureCombatReady(s) &&
        s.trainQueue.length < BARRACKS_QUEUE_MAX,
    )
    .sort((a, b) => a.trainQueue.length - b.trainQueue.length);

  if (barracks.length === 0) return null;

  const melee = state.units.filter((u) => u.ownerId === playerId && u.defId === "striker").length;
  const ranged = state.units.filter((u) => u.ownerId === playerId && u.defId === "bolter").length;
  const unitDefId: UnitDefId = melee <= ranged ? "striker" : "bolter";
  const def = unitDef(unitDefId);
  if (player.matter < def.cost) return null;

  const pick = barracks[0]!;
  return { barracksId: pick.instanceId, unitDefId };
}

export function countPlayerUnits(state: BuildSimState, playerId: string): number {
  return state.units.filter((u) => u.ownerId === playerId && u.hp > 0).length;
}

export function playerAtUnitCap(state: BuildSimState, playerId: string): boolean {
  return countPlayerUnits(state, playerId) >= PLAYER_UNIT_CAP;
}

export function canTrainAtHq(
  state: BuildSimState,
  hqId: string,
  playerId: string,
  unitDefId: UnitDefId,
): boolean {
  if (!isWorkerUnit(unitDefId)) return false;
  const s = state.structures.find((x) => x.instanceId === hqId);
  if (!s || s.ownerId !== playerId || s.defId !== "hq") return false;
  if (!structureCombatReady(s)) return false;
  if (s.trainQueue.length >= HQ_QUEUE_MAX) return false;
  if (playerAtUnitCap(state, playerId)) return false;
  const player = state.players.get(playerId);
  if (!player) return false;
  const def = unitDef(unitDefId);
  return player.matter >= def.cost;
}

export function queueTrainAtHq(
  state: BuildSimState,
  hqId: string,
  playerId: string,
  unitDefId: UnitDefId,
): BuildSimState | null {
  if (!canTrainAtHq(state, hqId, playerId, unitDefId)) return null;

  const def = unitDef(unitDefId);
  const player = state.players.get(playerId)!;
  const players = new Map(state.players);
  players.set(playerId, { ...player, matter: player.matter - def.cost });

  const structures = state.structures.map((s) => {
    if (s.instanceId !== hqId) return s;
    const entry: BarracksProduction = { unitDefId, progress: 0 };
    return { ...s, trainQueue: [...s.trainQueue, entry] };
  });

  return { ...state, players, structures };
}

export function advanceHqProduction(state: BuildSimState): BuildSimState {
  let next = state;
  const structures = next.structures.map((s) => {
    if (s.defId !== "hq" || s.trainQueue.length === 0 || !structureCombatReady(s)) {
      return s;
    }

    const head = s.trainQueue[0]!;
    const def = unitDef(head.unitDefId);
    const step = def.trainTicks > 0 ? 1 / def.trainTicks : 1;
    const progress = Math.min(1, head.progress + step);

    if (progress < 1) {
      const queue = [{ ...head, progress }, ...s.trainQueue.slice(1)];
      return { ...s, trainQueue: queue };
    }

    if (playerAtUnitCap(next, s.ownerId)) {
      return { ...s, trainQueue: [{ ...head, progress: 1 }, ...s.trainQueue.slice(1)] };
    }

    const preferred = hqSpawnPoint(s, s.trainQueue.length);
    const spawn = findSpawnPosition(next, preferred.x, preferred.y);
    next = spawnUnit(next, s.ownerId, head.unitDefId, spawn.x, spawn.y, s.rallyPoint);
    return { ...s, trainQueue: s.trainQueue.slice(1) };
  });

  return { ...next, structures };
}

/** Spawn starting workers beside each HQ. */
export function seedStartingWorkers(state: BuildSimState): BuildSimState {
  let next = state;
  for (const playerId of [...state.players.keys()]) {
    const hq = getPlayerHq(next, playerId);
    if (!hq) continue;
    for (let i = 0; i < STARTING_WORKERS; i++) {
      const preferred = hqSpawnPoint(hq, i);
      const spawn = findSpawnPosition(next, preferred.x, preferred.y);
      next = spawnUnit(next, playerId, "worker", spawn.x, spawn.y);
    }
  }
  return next;
}

/** AI: train a worker when construction sites need labor. */
export function aiWorkerTrainDecision(
  state: BuildSimState,
  playerId: string,
): { hqId: string; unitDefId: UnitDefId } | null {
  const hq = getPlayerHq(state, playerId);
  if (!hq || !structureCombatReady(hq)) return null;
  if (hq.trainQueue.length >= HQ_QUEUE_MAX) return null;

  const workers = countPlayerWorkers(state, playerId);
  const sites = incompleteStructuresForPlayer(state, playerId).length;
  const target = Math.max(STARTING_WORKERS, sites + 1);
  if (workers + hq.trainQueue.length >= target) return null;

  const player = state.players.get(playerId);
  if (!player) return null;
  const def = unitDef("worker");
  if (player.matter < def.cost) return null;

  return { hqId: hq.instanceId, unitDefId: "worker" };
}
