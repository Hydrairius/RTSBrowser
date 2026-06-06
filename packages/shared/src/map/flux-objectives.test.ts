import assert from "node:assert/strict";
import {
  advanceFluxObjectiveControl,
  FLUX_CAPTURE_TICKS,
  fluxObjectiveRemaining,
  SKIRMISH_FLUX_OBJECTIVES,
} from "./flux-objectives.js";
import {
  canPlaceStructure,
  createSkirmishBuildState,
  placeStructure,
  type BuildSimState,
} from "../structures/building.js";
import { HUMAN_PLAYER_ID, CELL_PX } from "../structures/defs.js";
import { structureMaxHp } from "../units/geometry.js";
import { advanceWorkerConstruction, issueWorkersGather } from "../units/construction.js";
import type { Unit } from "../units/types.js";

const mid = SKIRMISH_FLUX_OBJECTIVES.find((s) => s.id === "flux-mid")!;

function addHumanStrikerOnMid(state: BuildSimState): BuildSimState {
  const unit: Unit = {
    instanceId: `u-${state.nextUnitId}`,
    defId: "striker",
    ownerId: HUMAN_PLAYER_ID,
    x: mid.gx * CELL_PX + CELL_PX / 2,
    y: mid.gy * CELL_PX + CELL_PX / 2,
    hp: 80,
    order: { type: "idle" },
    attackCooldown: 0,
    meleeSwingTicks: 0,
  };
  return { ...state, units: [...state.units, unit], nextUnitId: state.nextUnitId + 1 };
}

function captureMid(state: BuildSimState): BuildSimState {
  let next = addHumanStrikerOnMid(state);
  for (let i = 0; i < FLUX_CAPTURE_TICKS; i++) {
    next = advanceFluxObjectiveControl(next);
  }
  return next;
}

function testExtractorRequiresCapture(): void {
  const state = createSkirmishBuildState("triad", "loop");
  const result = canPlaceStructure(state, HUMAN_PLAYER_ID, "extractor", mid.gx, mid.gy);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "flux_objective_not_controlled");
}

function testCapturedSiteAllowsExtractor(): void {
  let state = captureMid(createSkirmishBuildState("triad", "loop"));
  assert.equal(
    state.fluxObjectives.find((o) => o.siteId === mid.id)?.ownerId,
    HUMAN_PLAYER_ID,
  );

  const result = canPlaceStructure(state, HUMAN_PLAYER_ID, "extractor", mid.gx, mid.gy);
  assert.equal(result.ok, true);

  const placed = placeStructure(state, HUMAN_PLAYER_ID, "extractor", mid.gx, mid.gy);
  assert.ok(placed);
  state = placed!;
  assert.ok(state.consumedFluxObjectiveIds.includes(mid.id));
  assert.equal(fluxObjectiveRemaining(state, mid.id), 600);
}

function testExtractorMinesFlux(): void {
  let state = captureMid(createSkirmishBuildState("triad", "loop"));
  state = placeStructure(state, HUMAN_PLAYER_ID, "extractor", mid.gx, mid.gy)!;
  const extractor = state.structures.find((s) => s.defId === "extractor")!;
  state = {
    ...state,
    structures: state.structures.map((s) =>
      s.instanceId === extractor.instanceId
        ? { ...s, buildProgress: 1, hp: structureMaxHp("extractor") }
        : s,
    ),
    units: state.units.map((u) =>
      u.ownerId === HUMAN_PLAYER_ID && u.defId === "worker"
        ? {
            ...u,
            x: mid.gx * CELL_PX + CELL_PX / 2,
            y: mid.gy * CELL_PX + CELL_PX / 2,
          }
        : u,
    ),
  };

  const workers = new Set(
    state.units
      .filter((u) => u.ownerId === HUMAN_PLAYER_ID && u.defId === "worker")
      .map((u) => u.instanceId),
  );
  state = issueWorkersGather(state, workers, extractor.instanceId, HUMAN_PLAYER_ID);
  const before = state.players.get(HUMAN_PLAYER_ID)!.flux;
  state = advanceWorkerConstruction(state);
  const after = state.players.get(HUMAN_PLAYER_ID)!.flux;
  assert.ok(after > before, "workers at extractor should earn flux");
}

testExtractorRequiresCapture();
testCapturedSiteAllowsExtractor();
testExtractorMinesFlux();
console.log("flux-objectives.test.js: ok");
