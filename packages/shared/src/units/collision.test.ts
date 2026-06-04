import assert from "node:assert/strict";
import { createSkirmishBuildState } from "../structures/building.js";
import { HUMAN_PLAYER_ID } from "../structures/defs.js";
import { moveUnitToward, separateUnits, UNIT_COLLISION_RADIUS } from "./collision.js";
import type { Unit } from "./types.js";

function striker(id: string, x: number, y: number): Unit {
  return {
    instanceId: id,
    defId: "striker",
    ownerId: HUMAN_PLAYER_ID,
    x,
    y,
    hp: 100,
    order: { type: "idle" },
    attackCooldown: 0,
    meleeSwingTicks: 0,
  };
}

/** Crowd between goal and blocker — unit should still advance over several ticks. */
function testCrowdCanSlidePast(): void {
  let state = createSkirmishBuildState("triad", "block");
  const mover = striker("m1", 400, 400);
  const blockers = [
    striker("b1", 400, 430),
    striker("b2", 428, 400),
    striker("b3", 372, 400),
  ];
  state = { ...state, units: [mover, ...blockers] };

  let x = mover.x;
  let y = mover.y;
  for (let t = 0; t < 24; t++) {
    const step = moveUnitToward(state, "m1", x, y, 400, 520, 5);
    x = step.x;
    y = step.y;
    state = separateUnits({
      ...state,
      units: state.units.map((u) =>
        u.instanceId === "m1" ? { ...u, x, y } : u,
      ),
    });
  }

  assert.ok(y > 410, `mover should progress south through crowd (y=${y})`);
}

/** Two overlapping units should still separate to min gap. */
function testSeparationKeepsGap(): void {
  let state = createSkirmishBuildState("triad", "block");
  state = {
    ...state,
    units: [striker("a", 200, 200), striker("b", 200, 200)],
  };
  state = separateUnits(state);
  const a = state.units.find((u) => u.instanceId === "a")!;
  const b = state.units.find((u) => u.instanceId === "b")!;
  const d = Math.hypot(a.x - b.x, a.y - b.y);
  assert.ok(d >= UNIT_COLLISION_RADIUS * 2 - 1, `expected separation, dist=${d}`);
}

/** Pulling a selected unit away from a pack should not steer it back into the pack. */
function testPullAwayFromPack(): void {
  let state = createSkirmishBuildState("triad", "block");
  const mover = striker("m1", 400, 400);
  const pack = [
    striker("p1", 432, 400),
    striker("p2", 432, 430),
    striker("p3", 404, 430),
  ];
  state = { ...state, units: [mover, ...pack] };

  let x = mover.x;
  let y = mover.y;
  const startNearest = Math.min(...pack.map((u) => Math.hypot(x - u.x, y - u.y)));

  for (let t = 0; t < 12; t++) {
    const step = moveUnitToward(state, "m1", x, y, 280, 400, 5);
    x = step.x;
    y = step.y;
    state = separateUnits({
      ...state,
      units: state.units.map((u) =>
        u.instanceId === "m1" ? { ...u, x, y } : u,
      ),
    });
    const updated = state.units.find((u) => u.instanceId === "m1")!;
    x = updated.x;
    y = updated.y;
  }

  const endNearest = Math.min(...pack.map((u) => Math.hypot(x - u.x, y - u.y)));
  assert.ok(x < 380, `mover should advance away from pack (x=${x})`);
  assert.ok(
    endNearest > startNearest,
    `mover should increase distance from pack (${startNearest} -> ${endNearest})`,
  );
}

/** A unit that starts overlapped may step outward instead of staying glued. */
function testOverlappedUnitCanStepOutward(): void {
  let state = createSkirmishBuildState("triad", "block");
  state = {
    ...state,
    units: [striker("m1", 400, 400), striker("p1", 410, 400)],
  };

  const step = moveUnitToward(state, "m1", 400, 400, 300, 400, 5);
  assert.ok(step.x < 400, `overlapped mover should step away from blocker (x=${step.x})`);
}

testCrowdCanSlidePast();
testSeparationKeepsGap();
testPullAwayFromPack();
testOverlappedUnitCanStepOutward();
console.log("collision.test.ts: all passed");
