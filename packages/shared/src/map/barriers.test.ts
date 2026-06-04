import assert from "node:assert/strict";
import { createSkirmishBuildState } from "../structures/building.js";
import { canPlaceStructure } from "../structures/building.js";
import { AI_PLAYER_ID } from "../structures/defs.js";
import { footprintOverlapsBarrier, SKIRMISH_MAP_BARRIERS } from "./barriers.js";
import { isPositionBlocked } from "../units/collision.js";

function testBarriersDoNotCoverHqSpawns(): void {
  const state = createSkirmishBuildState("triad", "block");
  for (const hq of state.structures.filter((s) => s.defId === "hq")) {
    const fp = { w: 2, h: 2 };
    assert.ok(
      !footprintOverlapsBarrier(hq.gx, hq.gy, fp),
      `HQ at ${hq.gx},${hq.gy} must not overlap barriers`,
    );
  }
}

function testPlacementRejectedOnBarrier(): void {
  const state = createSkirmishBuildState("triad", "block");
  const result = canPlaceStructure(state, AI_PLAYER_ID, "generator", 103, 78);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "blocked_terrain");
}

function testUnitsCannotStandOnBarrier(): void {
  const state = createSkirmishBuildState("triad", "block");
  const wall = SKIRMISH_MAP_BARRIERS.find((b) => b.id === "neu-mid-rock-a")!;
  const x = (wall.gx + wall.w / 2) * 48;
  const y = (wall.gy + wall.h / 2) * 48;
  assert.ok(isPositionBlocked(state, x, y), "center of barrier should block units");
}

testBarriersDoNotCoverHqSpawns();
testPlacementRejectedOnBarrier();
testUnitsCannotStandOnBarrier();
