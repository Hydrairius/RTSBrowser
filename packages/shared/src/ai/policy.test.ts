import assert from "node:assert/strict";
import { createSkirmishBuildState } from "../structures/building.js";
import { AI_PLAYER_ID, CELL_PX } from "../structures/defs.js";
import { advanceSkirmishTick } from "../skirmish/tick.js";
import { unitDef } from "../units/defs.js";
import type { Unit } from "../units/types.js";
import {
  aiCombatStance,
  aiScoutDestinationWorld,
  AI_SCOUT_INTERVAL_TICKS,
} from "./policy.js";

function addAiStrikers(
  state: ReturnType<typeof createSkirmishBuildState>,
  count: number,
  order: Unit["order"] = { type: "idle" },
): ReturnType<typeof createSkirmishBuildState> {
  const def = unitDef("striker");
  const units = [...state.units];
  for (let i = 0; i < count; i++) {
    units.push({
      instanceId: `ai-s-${i}`,
      defId: "striker",
      ownerId: AI_PLAYER_ID,
      x: 135 * CELL_PX,
      y: 25 * CELL_PX + i * 8,
      hp: def.maxHp,
      order,
      attackCooldown: 0,
      meleeSwingTicks: 0,
    });
  }
  return { ...state, units };
}

function testScoutStanceWithoutVisibleTargets(): void {
  let state = createSkirmishBuildState("triad", "block");
  state = { ...state, tick: 800 };
  state = addAiStrikers(state, 8);
  assert.equal(aiCombatStance(state), "scout");
}

function testScoutIssuesMoveOrders(): void {
  let state = createSkirmishBuildState("triad", "block");
  state = { ...state, tick: AI_SCOUT_INTERVAL_TICKS - 1 };
  state = addAiStrikers(state, 8);
  const before = state.units.filter((u) => u.ownerId === AI_PLAYER_ID && u.order.type === "move")
    .length;
  state = advanceSkirmishTick(state);
  const after = state.units.filter((u) => u.ownerId === AI_PLAYER_ID && u.order.type === "move")
    .length;
  assert.ok(after > before, "scout wave should issue move orders");
}

function testScoutDestinationRotatesLanes(): void {
  const state = createSkirmishBuildState("triad", "block");
  const north = aiScoutDestinationWorld({ ...state, tick: 0 });
  const mid = aiScoutDestinationWorld({ ...state, tick: AI_SCOUT_INTERVAL_TICKS });
  assert.notEqual(north.y, mid.y, "lane rotation should change scout destination");
}

testScoutStanceWithoutVisibleTargets();
testScoutIssuesMoveOrders();
testScoutDestinationRotatesLanes();
console.log("policy.test: ok");
