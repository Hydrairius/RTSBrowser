import assert from "node:assert/strict";
import { advanceBuildTick, createSkirmishBuildState } from "../structures/building.js";
import { HUMAN_PLAYER_ID, AI_PLAYER_ID } from "../structures/defs.js";
import {
  advancePlayerVision,
  isCellExplored,
  isCellVisible,
  getPlayerVision,
  isUnitVisibleToPlayer,
} from "./vision.js";

function testStartingVisionAroundHq(): void {
  let state = createSkirmishBuildState("triad", "block");
  state = advancePlayerVision(state);
  const human = getPlayerVision(state, HUMAN_PLAYER_ID)!;
  assert.ok(isCellVisible(human, 25, 70), "human HQ cell visible");
  assert.ok(isCellExplored(human, 25, 70));
  const ai = getPlayerVision(state, AI_PLAYER_ID)!;
  assert.ok(!isCellVisible(ai, 25, 70), "AI should not see human HQ at start");
  assert.ok(isCellVisible(ai, 135, 25), "AI HQ cell visible to AI");
}

function testHumanDoesNotSeeDistantEnemyHq(): void {
  let state = createSkirmishBuildState("triad", "block");
  state = advancePlayerVision(state);
  const human = getPlayerVision(state, HUMAN_PLAYER_ID)!;
  assert.ok(!isCellVisible(human, 135, 25), "human should not see AI HQ without scouts");
}

function testEnemyUnitHiddenUntilInRange(): void {
  let state = createSkirmishBuildState("triad", "block");
  state.units.push({
    instanceId: "u-test",
    defId: "striker",
    ownerId: AI_PLAYER_ID,
    x: 135 * 48,
    y: 25 * 48,
    hp: 80,
    attackCooldown: 0,
    meleeSwingTicks: 0,
    order: { type: "idle" },
  });
  state = advancePlayerVision(state);
  const human = getPlayerVision(state, HUMAN_PLAYER_ID)!;
  const enemy = state.units.find((u) => u.instanceId === "u-test")!;
  assert.ok(!isUnitVisibleToPlayer(state, HUMAN_PLAYER_ID, enemy));

  enemy.x = 38 * 48;
  enemy.y = 72 * 48;
  state = advancePlayerVision({ ...state, units: [...state.units] });
  assert.ok(isUnitVisibleToPlayer(state, HUMAN_PLAYER_ID, enemy));
}

function testVisionSurvivesBuildTick(): void {
  let state = createSkirmishBuildState("triad", "block");
  state = advanceBuildTick(state);
  assert.ok(state.vision, "vision must persist across build ticks");
  state = advancePlayerVision(state);
  const human = getPlayerVision(state, HUMAN_PLAYER_ID)!;
  assert.ok(isCellVisible(human, 26, 71), "HQ area still visible after tick");
}

testStartingVisionAroundHq();
testHumanDoesNotSeeDistantEnemyHq();
testEnemyUnitHiddenUntilInRange();
testVisionSurvivesBuildTick();
