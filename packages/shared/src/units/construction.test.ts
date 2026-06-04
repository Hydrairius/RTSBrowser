import assert from "node:assert/strict";
import {
  advanceBuildTick,
  advanceWorkerConstruction,
  createSkirmishBuildState,
  getPlayerHq,
  placeStructure,
  HUMAN_PLAYER_ID,
} from "../index.js";
import { isPositionBlocked } from "./collision.js";
import { UNIT_COLLISION_RADIUS } from "./collision.js";
import { countPlayerWorkers, workersAtStructure } from "./construction.js";
import { distPx } from "./geometry.js";

function testStartingWorkersSpawnOutsideHq(): void {
  const state = createSkirmishBuildState("triad", "loop");
  const hq = getPlayerHq(state, HUMAN_PLAYER_ID)!;
  for (const u of state.units.filter((x) => x.ownerId === HUMAN_PLAYER_ID && x.defId === "worker")) {
    assert.equal(
      isPositionBlocked(state, u.x, u.y, u.instanceId),
      false,
      "worker must not spawn inside HQ collision",
    );
  }
  assert.ok(hq);
}

function testNoPassiveBuildWithoutWorkers(): void {
  let state = createSkirmishBuildState("triad", "loop");
  state = {
    ...state,
    units: state.units.filter((u) => u.ownerId !== HUMAN_PLAYER_ID),
  };
  const placed = placeStructure(state, HUMAN_PLAYER_ID, "generator", 30, 72);
  assert.ok(placed);
  state = placed!;
  const id = state.structures.find(
    (s) => s.defId === "generator" && s.ownerId === HUMAN_PLAYER_ID,
  )!.instanceId;
  assert.equal(workersAtStructure(state, id), 0);

  state = advanceBuildTick(state);
  const after = state.structures.find((s) => s.instanceId === id)!;
  assert.equal(after.buildProgress, 0);
}

function testWorkersAdvanceConstruction(): void {
  let state = createSkirmishBuildState("triad", "loop");
  const workers = state.units.filter(
    (u) => u.ownerId === HUMAN_PLAYER_ID && u.defId === "worker",
  );
  assert.ok(workers.length >= 2);

  const placed = placeStructure(state, HUMAN_PLAYER_ID, "generator", 30, 72);
  state = placed!;
  const site = state.structures.find(
    (s) => s.defId === "generator" && s.ownerId === HUMAN_PLAYER_ID,
  )!;
  assert.ok(countPlayerWorkers(state, HUMAN_PLAYER_ID) >= 2);

  for (let t = 0; t < 50; t++) {
    state = advanceWorkerConstruction(state);
    state = { ...state, tick: state.tick + 1 };
  }

  const built = state.structures.find((s) => s.instanceId === site.instanceId)!;
  assert.ok(built.buildProgress > 0, "workers should advance build progress");
}

function testGeneratorNeedsWorkersForIncome(): void {
  let state = createSkirmishBuildState("triad", "loop");
  const placed = placeStructure(state, HUMAN_PLAYER_ID, "generator", 30, 72);
  state = placed!;
  while (true) {
    const g = state.structures.find(
      (s) => s.defId === "generator" && s.ownerId === HUMAN_PLAYER_ID,
    )!;
    if (g.buildProgress >= 1) break;
    state = advanceWorkerConstruction(state);
    state = { ...state, tick: state.tick + 1 };
  }

  const matterBefore = state.players.get(HUMAN_PLAYER_ID)!.matter;
  state = advanceBuildTick(state);
  const matterPassive = state.players.get(HUMAN_PLAYER_ID)!.matter;
  assert.equal(matterPassive, matterBefore, "generators must not passively earn");

  const gen = state.structures.find(
    (s) => s.defId === "generator" && s.ownerId === HUMAN_PLAYER_ID,
  )!;
  const workers = state.units.filter(
    (u) => u.ownerId === HUMAN_PLAYER_ID && u.defId === "worker",
  );
  const w0 = workers[0]!;
  state = {
    ...state,
    units: state.units.map((u) =>
      u.instanceId === w0.instanceId
        ? { ...u, order: { type: "gather", structureId: gen.instanceId }, x: gen.gx * 48, y: gen.gy * 48 }
        : u,
    ),
  };
  for (let t = 0; t < 5; t++) {
    state = advanceWorkerConstruction(state);
    state = { ...state, tick: state.tick + 1 };
  }
  const matterAfter = state.players.get(HUMAN_PLAYER_ID)!.matter;
  assert.ok(matterAfter > matterBefore, "workers at generator should earn matter");
}

function testWorkersSpreadAroundBuildSite(): void {
  let state = createSkirmishBuildState("triad", "loop");
  const placed = placeStructure(state, HUMAN_PLAYER_ID, "generator", 30, 72);
  state = placed!;
  const site = state.structures.find(
    (s) => s.defId === "generator" && s.ownerId === HUMAN_PLAYER_ID,
  )!;
  const workers = state.units.filter(
    (u) => u.ownerId === HUMAN_PLAYER_ID && u.defId === "worker",
  );
  assert.ok(workers.length >= 2);

  state = {
    ...state,
    units: state.units.map((u) =>
      workers.some((w) => w.instanceId === u.instanceId)
        ? { ...u, order: { type: "construct", structureId: site.instanceId } }
        : u,
    ),
  };

  for (let t = 0; t < 25; t++) {
    state = advanceWorkerConstruction(state);
    state = { ...state, tick: state.tick + 1 };
  }

  const crew = state.units.filter(
    (u) =>
      u.ownerId === HUMAN_PLAYER_ID &&
      u.defId === "worker" &&
      u.order.type === "construct" &&
      u.order.structureId === site.instanceId,
  );
  assert.ok(crew.length >= 2);
  let minPair = Infinity;
  for (let i = 0; i < crew.length; i++) {
    for (let j = i + 1; j < crew.length; j++) {
      minPair = Math.min(
        minPair,
        distPx(crew[i]!.x, crew[i]!.y, crew[j]!.x, crew[j]!.y),
      );
    }
  }
  assert.ok(
    minPair >= UNIT_COLLISION_RADIUS * 2 * 0.85,
    `workers should not stack on one point (min dist ${minPair})`,
  );
}

testStartingWorkersSpawnOutsideHq();
testNoPassiveBuildWithoutWorkers();
testWorkersAdvanceConstruction();
testGeneratorNeedsWorkersForIncome();
testWorkersSpreadAroundBuildSite();
console.log("construction.test.js: ok");
