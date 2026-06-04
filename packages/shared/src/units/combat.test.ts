import assert from "node:assert/strict";
import { createSkirmishBuildState } from "../structures/building.js";
import { advancePlayerVision } from "../vision/vision.js";
import { HUMAN_PLAYER_ID, AI_PLAYER_ID } from "../structures/defs.js";
import { isPositionBlocked, separateUnits, UNIT_COLLISION_RADIUS } from "./collision.js";
import {
  advanceProjectiles,
  advanceUnitCombat,
  issueAttackOrder,
  issueStopOrder,
  spawnProjectile,
} from "./combat.js";
import { unitDef } from "./defs.js";
import type { Unit } from "./types.js";

function makeStriker(
  id: string,
  ownerId: string,
  x: number,
  y: number,
  order: Unit["order"],
): Unit {
  const def = unitDef("striker");
  return {
    instanceId: id,
    defId: "striker",
    ownerId,
    x,
    y,
    hp: def.maxHp,
    order,
    attackCooldown: 0,
    meleeSwingTicks: 0,
  };
}

/** Two strikers adjacent to one enemy — both must land melee damage in one tick. */
function testMeleeDamageNotLostInMapBug(): void {
  let state = createSkirmishBuildState("triad", "block");
  const enemy = makeStriker("e1", AI_PLAYER_ID, 200, 200, { type: "idle" });
  const s1 = makeStriker("h1", HUMAN_PLAYER_ID, 200, 248, {
    type: "attack",
    targetId: "e1",
    targetKind: "unit",
  });
  const s2 = makeStriker("h2", HUMAN_PLAYER_ID, 248, 200, {
    type: "attack",
    targetId: "e1",
    targetKind: "unit",
  });
  state = { ...state, units: [s1, s2, enemy] };
  state = advancePlayerVision(state);

  state = advanceUnitCombat(state);
  const e = state.units.find((u) => u.instanceId === "e1");
  assert.ok(e, "enemy should exist");
  const expectedMin = unitDef("striker").damage * 2;
  assert.ok(
    e!.hp <= unitDef("striker").maxHp - expectedMin + 1,
    `enemy hp ${e!.hp} should reflect at least two striker hits (expected <= ${unitDef("striker").maxHp - expectedMin})`,
  );
}

/** Striker in range with attack order must reduce target HP. */
function testSingleMeleeStrike(): void {
  let state = createSkirmishBuildState("triad", "block");
  const enemyHp = 80;
  const enemy = makeStriker("e1", AI_PLAYER_ID, 100, 100, { type: "idle" });
  enemy.hp = enemyHp;
  const striker = makeStriker("h1", HUMAN_PLAYER_ID, 100, 145, {
    type: "attack",
    targetId: "e1",
    targetKind: "unit",
  });
  state = { ...state, units: [striker, enemy] };
  state = advancePlayerVision(state);

  state = advanceUnitCombat(state);
  const e = state.units.find((u) => u.instanceId === "e1")!;
  assert.equal(e.hp, enemyHp - unitDef("striker").damage);
}

function testAttackOrderIssues(): void {
  const units = issueAttackOrder(
    [makeStriker("h1", HUMAN_PLAYER_ID, 0, 0, { type: "idle" })],
    new Set(["h1"]),
    "e1",
    "unit",
  );
  assert.equal(units[0]!.order.type, "attack");
}

function testUnitsDoNotStack(): void {
  let state = createSkirmishBuildState("triad", "block");
  const u1 = makeStriker("h1", HUMAN_PLAYER_ID, 100, 100, { type: "idle" });
  const u2 = makeStriker("h2", HUMAN_PLAYER_ID, 100, 100, { type: "idle" });
  state = { ...state, units: [u1, u2] };
  state = separateUnits(state);
  const a = state.units.find((u) => u.instanceId === "h1")!;
  const b = state.units.find((u) => u.instanceId === "h2")!;
  const d = Math.hypot(a.x - b.x, a.y - b.y);
  assert.ok(d >= UNIT_COLLISION_RADIUS * 2 - 1, `units should separate (dist=${d})`);
}

function testCannotStandOnStructure(): void {
  const state = createSkirmishBuildState("triad", "block");
  const hq = state.structures.find((s) => s.defId === "hq")!;
  const c = {
    x: (hq.gx + 1) * 48,
    y: (hq.gy + 1) * 48,
  };
  assert.ok(isPositionBlocked(state, c.x, c.y), "center of HQ footprint should be blocked");
}

testSingleMeleeStrike();
testMeleeDamageNotLostInMapBug();
testAttackOrderIssues();
testUnitsDoNotStack();
function testMoveOrderAggro(): void {
  let state = createSkirmishBuildState("triad", "block");
  const enemy = makeStriker("e1", AI_PLAYER_ID, 200, 200, { type: "idle" });
  const mover = makeStriker("h1", HUMAN_PLAYER_ID, 200, 280, {
    type: "move",
    x: 200,
    y: 400,
  });
  state = { ...state, units: [mover, enemy] };
  state = advancePlayerVision(state);
  state = advanceUnitCombat(state);
  const h = state.units.find((u) => u.instanceId === "h1")!;
  assert.equal(h.order.type, "attack");
  assert.equal((h.order as { targetId: string }).targetId, "e1");
}

/** Two bolter shots arriving the same tick must both deal damage (no cancel). */
function testMutualProjectilesBothHit(): void {
  let state = createSkirmishBuildState("triad", "block");
  const dmg = unitDef("bolter").damage;
  const aHp = 55;
  const bHp = 55;
  const a: Unit = {
    instanceId: "a",
    defId: "bolter",
    ownerId: HUMAN_PLAYER_ID,
    x: 100,
    y: 100,
    hp: aHp,
    order: { type: "idle" },
    attackCooldown: 0,
    meleeSwingTicks: 0,
  };
  const b: Unit = {
    instanceId: "b",
    defId: "bolter",
    ownerId: AI_PLAYER_ID,
    x: 160,
    y: 100,
    hp: bHp,
    order: { type: "idle" },
    attackCooldown: 0,
    meleeSwingTicks: 0,
  };
  state = { ...state, units: [a, b] };
  state = spawnProjectile(state, HUMAN_PLAYER_ID, a.x, a.y, "b", "unit", dmg, 80);
  state = spawnProjectile(state, AI_PLAYER_ID, b.x, b.y, "a", "unit", dmg, 80);
  state = advanceProjectiles(state);
  const afterA = state.units.find((u) => u.instanceId === "a")!;
  const afterB = state.units.find((u) => u.instanceId === "b")!;
  assert.equal(afterA.hp, aHp - dmg);
  assert.equal(afterB.hp, bHp - dmg);
}

function testIssueStopClearsMoveOrder(): void {
  const moving = makeStriker("m1", HUMAN_PLAYER_ID, 100, 100, { type: "move", x: 400, y: 400 });
  moving.navWaypoints = [{ x: 200, y: 200 }];
  const stopped = issueStopOrder([moving], new Set(["m1"]))[0]!;
  assert.equal(stopped.order.type, "idle");
  assert.equal(stopped.navWaypoints, undefined);
}

testCannotStandOnStructure();
testMoveOrderAggro();
testMutualProjectilesBothHit();
testIssueStopClearsMoveOrder();
console.log("combat.test.ts: all passed");
