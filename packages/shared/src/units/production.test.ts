import assert from "node:assert/strict";
import { createSkirmishBuildState } from "../structures/building.js";
import { HUMAN_PLAYER_ID } from "../structures/defs.js";
import {
  advanceHqProduction,
  canTrainAtBarracks,
  countPlayerUnits,
  PLAYER_UNIT_CAP,
  playerAtUnitCap,
  queueTrainAtBarracks,
  setProductionRallyPoint,
} from "./production.js";
import type { Unit } from "./types.js";

function fillUnits(state: ReturnType<typeof createSkirmishBuildState>, n: number) {
  const units: Unit[] = [];
  for (let i = 0; i < n; i++) {
    units.push({
      instanceId: `u-fill-${i}`,
      defId: "striker",
      ownerId: HUMAN_PLAYER_ID,
      x: 100,
      y: 100,
      hp: 1,
      order: { type: "idle" },
      attackCooldown: 0,
      meleeSwingTicks: 0,
    });
  }
  return { ...state, units: [...state.units, ...units] };
}

function testUnitCapBlocksTraining(): void {
  let state = createSkirmishBuildState("triad", "block");
  const barracks = state.structures.find(
    (s) => s.ownerId === HUMAN_PLAYER_ID && s.defId === "barracks",
  );
  assert.ok(!barracks, "fresh match has no barracks");

  const hq = state.structures.find((s) => s.ownerId === HUMAN_PLAYER_ID && s.defId === "hq")!;
  state = {
    ...state,
    structures: [
      ...state.structures,
      {
        instanceId: "b-test",
        defId: "barracks",
        ownerId: HUMAN_PLAYER_ID,
        gx: hq.gx + 4,
        gy: hq.gy,
        buildProgress: 1,
        hp: 500,
        maxHp: 500,
        trainQueue: [],
      },
    ],
  };

  const existing = countPlayerUnits(state, HUMAN_PLAYER_ID);
  state = fillUnits(state, PLAYER_UNIT_CAP - existing);
  assert.equal(countPlayerUnits(state, HUMAN_PLAYER_ID), PLAYER_UNIT_CAP);
  assert.ok(playerAtUnitCap(state, HUMAN_PLAYER_ID));
  assert.ok(!canTrainAtBarracks(state, "b-test", HUMAN_PLAYER_ID, "striker"));
  assert.equal(queueTrainAtBarracks(state, "b-test", HUMAN_PLAYER_ID, "striker"), null);
}

function testRallyPointOrdersSpawnedUnit(): void {
  let state = createSkirmishBuildState("triad", "block");
  const hq = state.structures.find((s) => s.ownerId === HUMAN_PLAYER_ID && s.defId === "hq")!;
  const rallyX = 420;
  const rallyY = 380;
  state = setProductionRallyPoint(state, [hq.instanceId], HUMAN_PLAYER_ID, rallyX, rallyY);
  const beforeIds = new Set(state.units.map((u) => u.instanceId));
  state = {
    ...state,
    structures: state.structures.map((s) =>
      s.instanceId === hq.instanceId
        ? { ...s, trainQueue: [{ unitDefId: "worker", progress: 0.99 }] }
        : s,
    ),
  };
  state = advanceHqProduction(state);
  const spawned = state.units.filter((u) => !beforeIds.has(u.instanceId));
  assert.equal(spawned.length, 1);
  assert.equal(spawned[0]!.order.type, "move");
  if (spawned[0]!.order.type === "move") {
    assert.equal(spawned[0]!.order.x, rallyX);
    assert.equal(spawned[0]!.order.y, rallyY);
  }
}

testUnitCapBlocksTraining();
testRallyPointOrdersSpawnedUnit();
console.log("production.test: ok");
