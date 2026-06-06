import { availableMatterDeposits } from "../map/matter-deposits.js";
import { availableFluxObjectives } from "../map/flux-objectives.js";
import type { BuildSimState, PlacedStructure } from "../structures/building.js";
import { countStructures, getPlayerHq } from "../structures/building.js";
import {
  AI_PLAYER_ID,
  CELL_PX,
  HUMAN_PLAYER_ID,
  structureDef,
  type PlayerZone,
  type StructureDefId,
} from "../structures/defs.js";
import { countPlayerUnits } from "../units/production.js";
import {
  isStructureVisibleToPlayer,
  isUnitVisibleToPlayer,
} from "../vision/vision.js";
import { distPx, structureCenterPx, structureCombatReady } from "../units/geometry.js";
import type { TargetKind, Unit } from "../units/types.js";

export type AiCombatStance = "hold" | "defend" | "attack" | "scout";

/** Human units this close to AI HQ trigger defense. */
export const AI_DEFEND_HQ_RADIUS_PX = CELL_PX * 18;
/** Human units this close to any AI structure trigger defense. */
export const AI_DEFEND_STRUCT_RADIUS_PX = CELL_PX * 10;

/** Generator count goal rises over the match (replaces a flat cap of 4). */
export function aiGeneratorCap(tick: number): number {
  return Math.min(2 + Math.floor(tick / 350), 6);
}

/** Barracks count goal rises more slowly. */
export function aiBarracksCap(tick: number): number {
  return Math.min(1 + Math.floor(tick / 500), 3);
}

/** Defensive turret count goal (after economy + production). */
export function aiTurretCap(tick: number): number {
  return Math.min(1 + Math.floor(tick / 400), 4);
}

/** Matter to keep available for the next planned structure before training. */
export function aiMatterReserve(
  state: BuildSimState,
  playerId: string,
  tick: number,
): number {
  const player = state.players.get(playerId);
  if (!player) return 0;

  const generators = countStructures(state, playerId, "generator");
  const extractors = countStructures(state, playerId, "extractor");
  const barracks = countStructures(state, playerId, "barracks");
  const turrets = countStructures(state, playerId, "turret");
  const genCap = Math.min(aiGeneratorCap(tick), generators + availableMatterDeposits(state, playerId).length);
  const barCap = aiBarracksCap(tick);
  const turCap = aiTurretCap(tick);

  if (generators < genCap && player.matter < 120) return 120;
  if (generators < genCap) return 140;
  if (extractors < availableFluxObjectives(state, playerId).length && player.matter < 160) return 160;
  if (extractors < availableFluxObjectives(state, playerId).length) return 180;
  if (barracks < barCap && player.matter < 150) return 150;
  if (barracks < barCap) return 180;
  if (turrets < turCap && player.matter < 175) return 175;
  if (turrets < turCap) return 200;
  return 60;
}

export function aiShouldTrainUnits(
  state: BuildSimState,
  playerId: string,
  tick: number,
): boolean {
  const player = state.players.get(playerId);
  if (!player) return false;

  const generators = countStructures(state, playerId, "generator");
  const genGoal = Math.min(
    2,
    aiGeneratorCap(tick),
    generators + availableMatterDeposits(state, playerId).length,
  );
  if (generators < genGoal) return false;

  return player.matter >= aiMatterReserve(state, playerId, tick) + 40;
}

/** Minimum living units before the AI starts offensive waves. */
export function aiMinArmyToAttack(tick: number): number {
  return Math.min(14, 5 + Math.floor(tick / 280));
}

/** Units sent per attack wave (not the whole army). */
export function aiAttackWaveSize(tick: number, army: number): number {
  const base = 3 + Math.floor(tick / 220);
  return Math.min(Math.max(3, base), Math.max(3, Math.floor(army * 0.45)));
}

/** Ticks between attack waves; slower early so the base can grow first. */
export function aiAttackInterval(tick: number): number {
  return tick < 600 ? 70 : tick < 1200 ? 55 : 45;
}

/** Defense reactions run more often than attack waves. */
export const AI_DEFEND_INTERVAL_TICKS = 18;

/** Ticks between scout move orders (rotate neutral lane waypoints). */
export const AI_SCOUT_INTERVAL_TICKS = 38;

/** Combat units sent per scout wave. */
export const AI_SCOUT_WAVE_SIZE = 2;

/** Minimum army before scouting when no visible attack targets. */
export const AI_MIN_UNITS_TO_SCOUT = 2;

/** Neutral lane midpoints (gx, gy) — see features/map-terrain/data/layout-v0.md */
const SCOUT_LANE_CELLS: readonly { gx: number; gy: number }[] = [
  { gx: 88, gy: 22 },
  { gx: 88, gy: 66 },
  { gx: 88, gy: 106 },
];

/** Human units threatening the AI base (near HQ or any AI structure). */
export function humanThreatsNearAi(state: BuildSimState): Unit[] {
  const aiHq = getPlayerHq(state, AI_PLAYER_ID);
  const hqCenter = aiHq ? structureCenterPx(aiHq) : null;
  const aiStructs = state.structures.filter(
    (s) => s.ownerId === AI_PLAYER_ID && structureCombatReady(s),
  );

  return state.units.filter((u) => {
    if (u.ownerId !== HUMAN_PLAYER_ID || u.hp <= 0) return false;
    if (!isUnitVisibleToPlayer(state, AI_PLAYER_ID, u)) return false;
    if (hqCenter && distPx(u.x, u.y, hqCenter.x, hqCenter.y) <= AI_DEFEND_HQ_RADIUS_PX) {
      return true;
    }
    for (const s of aiStructs) {
      const c = structureCenterPx(s);
      if (distPx(u.x, u.y, c.x, c.y) <= AI_DEFEND_STRUCT_RADIUS_PX) return true;
    }
    return false;
  });
}

export function aiHasVisibleAttackTarget(
  state: BuildSimState,
  army: number,
): boolean {
  return aiPickAttackTarget(state, army) !== null;
}

/** World pixel center for the active scout lane (rotates over time). */
export function aiScoutDestinationWorld(state: BuildSimState): { x: number; y: number } {
  const lane =
    SCOUT_LANE_CELLS[
      Math.floor(state.tick / AI_SCOUT_INTERVAL_TICKS) % SCOUT_LANE_CELLS.length
    ]!;
  return {
    x: lane.gx * CELL_PX + CELL_PX / 2,
    y: lane.gy * CELL_PX + CELL_PX / 2,
  };
}

/**
 * Combat priority: defend when threatened; attack visible targets; scout to reveal fog otherwise.
 */
export function aiCombatStance(state: BuildSimState): AiCombatStance {
  const army = countPlayerUnits(state, AI_PLAYER_ID);
  const threats = humanThreatsNearAi(state);

  if (threats.length > 0) {
    return army >= 2 ? "defend" : "hold";
  }
  if (army >= aiMinArmyToAttack(state.tick)) {
    return aiHasVisibleAttackTarget(state, army) ? "attack" : "scout";
  }
  if (army >= AI_MIN_UNITS_TO_SCOUT && !aiHasVisibleAttackTarget(state, army)) {
    return "scout";
  }
  return "hold";
}

export function aiPickDefendTarget(state: BuildSimState): {
  targetId: string;
  targetKind: TargetKind;
} | null {
  const threats = humanThreatsNearAi(state);
  if (threats.length === 0) return null;

  const aiHq = getPlayerHq(state, AI_PLAYER_ID);
  const anchor = aiHq
    ? structureCenterPx(aiHq)
    : { x: 0, y: 0 };

  threats.sort(
    (a, b) =>
      distPx(a.x, a.y, anchor.x, anchor.y) - distPx(b.x, b.y, anchor.x, anchor.y),
  );
  const pick = threats[0]!;
  return { targetId: pick.instanceId, targetKind: "unit" };
}

/** Units to pull into defense (includes recalled attackers when base is threatened). */
export function aiDefendWaveSize(threatCount: number, army: number): number {
  const urgency = Math.min(threatCount, 4);
  const base = 2 + urgency * 2;
  return Math.min(army, Math.max(base, Math.floor(army * (0.35 + urgency * 0.1))));
}

export function aiShouldRecallForDefense(
  state: BuildSimState,
  unit: Unit,
  threats: Unit[],
): boolean {
  if (unit.order.type !== "attack" || threats.length === 0) return false;
  const aiHq = getPlayerHq(state, AI_PLAYER_ID);
  if (!aiHq) return true;
  const hq = structureCenterPx(aiHq);
  return distPx(unit.x, unit.y, hq.x, hq.y) > CELL_PX * 10;
}

/** Prefer forward build sites (west in AI territory) with some spread from HQ. */
export function scoreAiBuildSite(
  gx: number,
  gy: number,
  zone: PlayerZone,
  hq: PlacedStructure,
  footprint: { w: number; h: number },
): number {
  const hqFp = structureDef("hq").footprint;
  const cx = gx + footprint.w / 2;
  const cy = gy + footprint.h / 2;
  const hqCx = hq.gx + hqFp.w / 2;
  const hqCy = hq.gy + hqFp.h / 2;
  const cheb = Math.max(Math.abs(cx - hqCx), Math.abs(cy - hqCy));

  const towardFront = (zone.maxGx - gx) * 4;
  const spread =
    cheb >= 5 && cheb <= 20 ? 12 : cheb < 5 ? -15 : cheb > 22 ? -4 : 0;
  return towardFront + spread;
}

export function aiPickAttackTarget(
  state: BuildSimState,
  army: number,
): { targetId: string; targetKind: TargetKind } | null {
  const visibleUnits = state.units.filter(
    (u) =>
      u.ownerId === HUMAN_PLAYER_ID &&
      u.hp > 0 &&
      isUnitVisibleToPlayer(state, AI_PLAYER_ID, u),
  );
  if (visibleUnits.length > 0) {
    visibleUnits.sort((a, b) => b.x - a.x);
    const pick = visibleUnits[0]!;
    return { targetId: pick.instanceId, targetKind: "unit" };
  }

  const humanStructs = state.structures.filter(
    (s) =>
      s.ownerId === HUMAN_PLAYER_ID &&
      structureCombatReady(s) &&
      s.hp > 0 &&
      isStructureVisibleToPlayer(state, AI_PLAYER_ID, s),
  );

  if (humanStructs.length === 0) return null;

  const nonHq = humanStructs.filter((s) => s.defId !== "hq");
  if (army < 12 && nonHq.length > 0) {
    nonHq.sort((a, b) => b.gx - a.gx);
    const pick = nonHq[0]!;
    return { targetId: pick.instanceId, targetKind: "structure" };
  }

  const hq = humanStructs.find((s) => s.defId === "hq");
  if (hq) return { targetId: hq.instanceId, targetKind: "structure" };

  humanStructs.sort((a, b) => b.gx - a.gx);
  const pick = humanStructs[0]!;
  return { targetId: pick.instanceId, targetKind: "structure" };
}

export function aiStructureGoal(
  state: BuildSimState,
  playerId: string,
  tick: number,
): StructureDefId | null {
  const player = state.players.get(playerId);
  if (!player) return null;

  const generators = countStructures(state, playerId, "generator");
  const extractors = countStructures(state, playerId, "extractor");
  const barracks = countStructures(state, playerId, "barracks");
  const turrets = countStructures(state, playerId, "turret");
  const genCap = Math.min(
    aiGeneratorCap(tick),
    generators + availableMatterDeposits(state, playerId).length,
  );
  const barCap = aiBarracksCap(tick);
  const turCap = aiTurretCap(tick);

  if (generators < genCap && player.matter >= 120) return "generator";
  if (extractors < availableFluxObjectives(state, playerId).length && player.matter >= 160) {
    return "extractor";
  }
  if (barracks < barCap && player.matter >= 150) return "barracks";
  if (turrets < turCap && player.matter >= 175) return "turret";
  return null;
}
