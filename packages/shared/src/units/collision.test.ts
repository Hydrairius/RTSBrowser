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

testCrowdCanSlidePast();
testSeparationKeepsGap();
console.log("collision.test.ts: all passed");
