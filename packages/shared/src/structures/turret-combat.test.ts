import assert from "node:assert/strict";
import {
  advanceStructureTurrets,
} from "./turret-combat.js";
import {
  createSkirmishBuildState,
  placeStructure,
  type BuildSimState,
} from "./building.js";
import {
  AI_PLAYER_ID,
  CELL_PX,
  HUMAN_PLAYER_ID,
  structureDef,
} from "./defs.js";
import { advanceProjectiles } from "../units/combat.js";
import { structureCenterPx } from "../units/geometry.js";
import { unitDef } from "../units/defs.js";
import type { Unit } from "../units/types.js";

function makeStriker(
  id: string,
  ownerId: string,
  x: number,
  y: number,
): Unit {
  const def = unitDef("striker");
  return {
    instanceId: id,
    defId: "striker",
    ownerId,
    x,
    y,
    hp: def.maxHp,
    order: { type: "idle" },
    attackCooldown: 0,
    meleeSwingTicks: 0,
  };
}

function placeTurret(
  state: BuildSimState,
  playerId: string,
  gx: number,
  gy: number,
): BuildSimState {
  const next = placeStructure(state, playerId, "turret", gx, gy);
  assert.ok(next, "turret placement should succeed");
  const s = next.structures.find(
    (x) => x.defId === "turret" && x.ownerId === playerId && x.gx === gx && x.gy === gy,
  )!;
  const structures = next.structures.map((x) =>
    x.instanceId === s.instanceId
      ? { ...x, buildProgress: 1, hp: x.maxHp }
      : x,
  );
  return { ...next, structures };
}

function enemyNearTurret(state: BuildSimState): Unit {
  const turret = state.structures.find((s) => s.defId === "turret")!;
  const center = structureCenterPx(turret);
  const range = structureDef("turret").turretRangePx!;
  return makeStriker(
    "u-enemy",
    HUMAN_PLAYER_ID,
    center.x + range * 0.5,
    center.y,
  );
}

function testTurretFiresProjectileAtIntruder(): void {
  let state = createSkirmishBuildState("block", "loop");
  state = placeTurret(state, AI_PLAYER_ID, 140, 30);
  state = {
    ...state,
    units: [enemyNearTurret(state)],
  };

  state = advanceStructureTurrets(state);
  assert.equal(state.projectiles.length, 1, "turret should spawn a projectile");
  assert.equal(state.projectiles[0]!.ownerId, AI_PLAYER_ID);

  for (let i = 0; i < 80 && state.projectiles.length > 0; i++) {
    state = advanceProjectiles(state);
  }
  const enemy = state.units.find((u) => u.instanceId === "u-enemy");
  assert.ok(enemy && enemy.hp < 80, "projectile should damage the intruder");
}

function testTurretRespectsCooldown(): void {
  let state = createSkirmishBuildState("block", "loop");
  state = placeTurret(state, AI_PLAYER_ID, 140, 30);
  state = {
    ...state,
    units: [enemyNearTurret(state)],
  };

  state = advanceStructureTurrets(state);
  const afterFirst = state.projectiles.length;
  state = advanceStructureTurrets(state);
  assert.equal(state.projectiles.length, afterFirst, "cooldown should block a second shot");
}

function testTurretIgnoresOutOfRange(): void {
  let state = createSkirmishBuildState("block", "loop");
  state = placeTurret(state, AI_PLAYER_ID, 140, 30);
  const turret = state.structures.find((s) => s.defId === "turret")!;
  const center = structureCenterPx(turret);
  const far = structureDef("turret").turretRangePx! + CELL_PX * 2;
  state = {
    ...state,
    units: [makeStriker("u-far", HUMAN_PLAYER_ID, center.x + far, center.y)],
  };

  state = advanceStructureTurrets(state);
  assert.equal(state.projectiles.length, 0);
}

testTurretFiresProjectileAtIntruder();
testTurretRespectsCooldown();
testTurretIgnoresOutOfRange();
console.log("turret-combat.test: ok");
