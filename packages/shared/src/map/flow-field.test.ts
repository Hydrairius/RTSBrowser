import assert from "node:assert/strict";
import { createSkirmishBuildState } from "../structures/building.js";
import { CELL_PX } from "../structures/defs.js";
import {
  buildFlowField,
  flowFieldIntegrateChecksum,
  sampleFlowDirection,
} from "./flow-field.js";
import { cellIndex } from "./nav-grid.js";
import { hasCellLineOfSight } from "./pathfind.js";
import { FLOW_SQUAD_MIN_UNITS } from "../units/flow-navigation.js";
import { advanceUnitCombat, issueMoveOrderSpread } from "../units/combat.js";

function testFlowFieldReachableMidLane(): void {
  const state = createSkirmishBuildState("triad", "block");
  const goal = { gx: 105, gy: 66 };
  const field = buildFlowField(state, goal.gx, goal.gy);
  assert.ok(field, "goal cell should be reachable");

  const start = { gx: 75, gy: 66 };
  const startIdx = cellIndex(start.gx, start.gy);
  assert.ok(field.integrate[startIdx]! < Number.POSITIVE_INFINITY);

  let gx = start.gx;
  let gy = start.gy;
  for (let step = 0; step < 200; step++) {
    if (gx === goal.gx && gy === goal.gy) return;
    const dir = sampleFlowDirection(field, gx, gy);
    assert.ok(dir, `flow should exist at ${gx},${gy} step ${step}`);
    gx += Math.sign(dir.dx);
    gy += Math.sign(dir.dy);
  }
  assert.fail("flow integration should reach goal along downhill steps");
}

function testFlowChecksumStable(): void {
  const state = createSkirmishBuildState("triad", "block");
  const a = buildFlowField(state, 105, 66);
  const b = buildFlowField(state, 105, 66);
  assert.ok(a && b);
  assert.equal(flowFieldIntegrateChecksum(a), flowFieldIntegrateChecksum(b));
}

function testFlowStepReducesIntegration(): void {
  const state = createSkirmishBuildState("triad", "block");
  const start = { gx: 75, gy: 66 };
  const goal = { gx: 105, gy: 66 };
  assert.ok(!hasCellLineOfSight(state, start.gx, start.gy, goal.gx, goal.gy));

  const field = buildFlowField(state, goal.gx, goal.gy)!;
  const startCost = field.integrate[cellIndex(start.gx, start.gy)]!;
  const dir = sampleFlowDirection(field, start.gx, start.gy);
  assert.ok(dir);
  const nextGx = start.gx + Math.sign(dir.dx);
  const nextGy = start.gy + Math.sign(dir.dy);
  const nextCost = field.integrate[cellIndex(nextGx, nextGy)]!;
  assert.ok(nextCost < startCost, "flow step should decrease cost-to-goal");
}

function testSquadMoveUsesFlowFlag(): void {
  const state = createSkirmishBuildState("triad", "block");
  const ids = new Set<string>();
  const squad: typeof state.units = [];
  for (let i = 0; i < FLOW_SQUAD_MIN_UNITS; i++) {
    const u = state.units[0];
    if (!u) return;
    const clone = {
      ...u,
      instanceId: `u-test-${i}`,
      x: 75 * CELL_PX + i * 4,
      y: 66 * CELL_PX,
    };
    squad.push(clone);
    ids.add(clone.instanceId);
  }
  const toX = 105 * CELL_PX;
  const toY = 66 * CELL_PX;
  const moved = issueMoveOrderSpread({ ...state, units: squad }, squad, ids, toX, toY);
  for (const u of moved) {
    assert.equal(u.navUseFlow, true);
    assert.deepEqual(u.navFlowGoal, { x: toX, y: toY });
    assert.ok(!u.navWaypoints?.length, "flow squads should not bake A* waypoints");
  }
}

function testSquadMoveSharesOneFlowField(): void {
  let state = createSkirmishBuildState("triad", "block");
  const ids = new Set<string>();
  const squad: typeof state.units = [];
  for (let i = 0; i < FLOW_SQUAD_MIN_UNITS + 4; i++) {
    const u = state.units[0];
    if (!u) return;
    const clone = {
      ...u,
      defId: "striker" as const,
      instanceId: `flow-cache-${i}`,
      x: 75 * CELL_PX + i * 4,
      y: 66 * CELL_PX,
      order: { type: "idle" as const },
    };
    squad.push(clone);
    ids.add(clone.instanceId);
  }
  const toX = 105 * CELL_PX;
  const toY = 66 * CELL_PX;
  state = {
    ...state,
    units: issueMoveOrderSpread({ ...state, units: squad }, squad, ids, toX, toY),
    flowFields: undefined,
  };

  state = advanceUnitCombat(state);
  assert.equal(state.flowFields?.size, 1, "spread squad should share one flow field");
}

testFlowFieldReachableMidLane();
testFlowChecksumStable();
testFlowStepReducesIntegration();
testSquadMoveUsesFlowFlag();
testSquadMoveSharesOneFlowField();
