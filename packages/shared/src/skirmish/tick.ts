import { advancePlayerVision } from "../vision/vision.js";
import { advanceBuildTickWithAi } from "../structures/ai-builder.js";
import { advanceStructureTurrets } from "../structures/turret-combat.js";
import type { BuildSimState } from "../structures/building.js";
import { AI_PLAYER_ID, HUMAN_PLAYER_ID } from "../structures/defs.js";
import { getPlayerHq } from "../structures/building.js";
import { aiIssueAttackOrders } from "../units/ai-units.js";
import {
  advanceProjectiles,
  advanceUnitCombat,
  pruneDead,
} from "../units/combat.js";
import { advanceWorkerConstruction } from "../units/construction.js";
import {
  advanceBarracksProduction,
  advanceHqProduction,
  AI_TRAIN_INTERVAL_TICKS,
  aiTrainDecision,
  aiWorkerTrainDecision,
  queueTrainAtBarracks,
  queueTrainAtHq,
} from "../units/production.js";

export type SkirmishOutcome = "ongoing" | "human_victory" | "human_defeat";

export function checkSkirmishOutcome(state: BuildSimState): SkirmishOutcome {
  const humanHq = getPlayerHq(state, HUMAN_PLAYER_ID);
  const aiHq = getPlayerHq(state, AI_PLAYER_ID);
  if (!humanHq || humanHq.hp <= 0) return "human_defeat";
  if (!aiHq || aiHq.hp <= 0) return "human_victory";
  return "ongoing";
}

export function advanceSkirmishTick(state: BuildSimState): BuildSimState {
  let next = advanceBuildTickWithAi(state);
  next = advanceWorkerConstruction(next);
  next = advanceHqProduction(next);
  next = advanceBarracksProduction(next);
  next = advanceUnitCombat(next);
  next = advanceStructureTurrets(next);
  next = advanceProjectiles(next);
  next = pruneDead(next);

  if (next.tick % AI_TRAIN_INTERVAL_TICKS === 0) {
    const workerTrain = aiWorkerTrainDecision(next, AI_PLAYER_ID);
    if (workerTrain) {
      const wq = queueTrainAtHq(next, workerTrain.hqId, AI_PLAYER_ID, workerTrain.unitDefId);
      if (wq) next = wq;
    }
    const train = aiTrainDecision(next, AI_PLAYER_ID);
    if (train) {
      const queued = queueTrainAtBarracks(next, train.barracksId, AI_PLAYER_ID, train.unitDefId);
      if (queued) next = queued;
    }
  }

  next = aiIssueAttackOrders(next);
  next = advancePlayerVision(next);
  return next;
}
