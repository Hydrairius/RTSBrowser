import {
  AI_DEFEND_INTERVAL_TICKS,
  AI_SCOUT_INTERVAL_TICKS,
  AI_SCOUT_WAVE_SIZE,
  aiAttackInterval,
  aiAttackWaveSize,
  aiCombatStance,
  aiDefendWaveSize,
  aiMinArmyToAttack,
  aiPickAttackTarget,
  aiPickDefendTarget,
  aiScoutDestinationWorld,
  aiShouldRecallForDefense,
  humanThreatsNearAi,
} from "../ai/policy.js";
import { AI_PLAYER_ID } from "../structures/defs.js";
import type { BuildSimState } from "../structures/building.js";
import { isCombatUnit } from "./defs.js";
import { distPx } from "./geometry.js";
import { issueAttackOrder, issueMoveOrderSpread } from "./combat.js";
import { countPlayerUnits } from "./production.js";
import type { Unit } from "./types.js";

function selectAttackWaveUnits(state: BuildSimState, maxWave: number): Set<string> {
  const pool = state.units.filter(
    (u) =>
      u.ownerId === AI_PLAYER_ID &&
      u.hp > 0 &&
      (u.order.type === "idle" || u.order.type === "move"),
  );
  pool.sort((a, b) => a.x - b.x);
  return new Set(pool.slice(0, maxWave).map((u) => u.instanceId));
}

function selectDefendWaveUnits(
  state: BuildSimState,
  maxWave: number,
  threats: Unit[],
  defendTargetId: string,
  threatX: number,
  threatY: number,
): Set<string> {
  const pool = state.units.filter((u) => {
    if (u.ownerId !== AI_PLAYER_ID || u.hp <= 0) return false;
    if (u.order.type === "idle" || u.order.type === "move") return true;
    if (u.order.type === "attack") {
      if (u.order.targetId === defendTargetId) return false;
      return aiShouldRecallForDefense(state, u, threats);
    }
    return false;
  });

  pool.sort(
    (a, b) =>
      distPx(a.x, a.y, threatX, threatY) - distPx(b.x, b.y, threatX, threatY),
  );
  return new Set(pool.slice(0, maxWave).map((u) => u.instanceId));
}

function aiIssueDefendOrders(state: BuildSimState): BuildSimState {
  if (state.tick % AI_DEFEND_INTERVAL_TICKS !== 0) return state;

  const threats = humanThreatsNearAi(state);
  if (threats.length === 0) return state;

  const target = aiPickDefendTarget(state);
  if (!target) return state;

  const army = countPlayerUnits(state, AI_PLAYER_ID);
  const waveSize = aiDefendWaveSize(threats.length, army);
  const threatUnit = state.units.find((u) => u.instanceId === target.targetId);
  if (!threatUnit) return state;
  const waveIds = selectDefendWaveUnits(
    state,
    waveSize,
    threats,
    target.targetId,
    threatUnit.x,
    threatUnit.y,
  );
  if (waveIds.size === 0) return state;

  return {
    ...state,
    units: issueAttackOrder(
      state.units,
      waveIds,
      target.targetId,
      target.targetKind,
    ),
  };
}

function selectScoutWaveUnits(state: BuildSimState, maxWave: number): Set<string> {
  const pool = state.units.filter(
    (u) =>
      u.ownerId === AI_PLAYER_ID &&
      u.hp > 0 &&
      isCombatUnit(u.defId) &&
      (u.order.type === "idle" || u.order.type === "move"),
  );
  pool.sort((a, b) => a.x - b.x);
  return new Set(pool.slice(0, maxWave).map((u) => u.instanceId));
}

function aiIssueScoutOrders(state: BuildSimState): BuildSimState {
  if (state.tick % AI_SCOUT_INTERVAL_TICKS !== 0) return state;

  const waveIds = selectScoutWaveUnits(state, AI_SCOUT_WAVE_SIZE);
  if (waveIds.size === 0) return state;

  const dest = aiScoutDestinationWorld(state);
  return {
    ...state,
    units: issueMoveOrderSpread(state, state.units, waveIds, dest.x, dest.y),
  };
}

function aiIssueOffenseOrders(state: BuildSimState): BuildSimState {
  const interval = aiAttackInterval(state.tick);
  if (state.tick % interval !== 0) return state;

  const army = countPlayerUnits(state, AI_PLAYER_ID);
  if (army < aiMinArmyToAttack(state.tick)) return state;

  const target = aiPickAttackTarget(state, army);
  if (!target) return state;

  const waveSize = aiAttackWaveSize(state.tick, army);
  const waveIds = selectAttackWaveUnits(state, waveSize);
  if (waveIds.size === 0) return state;

  return {
    ...state,
    units: issueAttackOrder(
      state.units,
      waveIds,
      target.targetId,
      target.targetKind,
    ),
  };
}

/** Assign attack/defend orders based on current combat priority. */

export function aiIssueAttackOrders(state: BuildSimState): BuildSimState {

  const stance = aiCombatStance(state);



  if (stance === "defend") {

    return aiIssueDefendOrders(state);

  }

  if (stance === "attack") {

    return aiIssueOffenseOrders(state);

  }

  if (stance === "scout") {

    return aiIssueScoutOrders(state);

  }

  return state;

}

