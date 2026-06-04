import assert from "node:assert/strict";
import { createSkirmishBuildState } from "../structures/building.js";
import { CELL_PX } from "../structures/defs.js";
import { findCellPath, findWorldPath, hasCellLineOfSight, isNavCellWalkable } from "./pathfind.js";
import { issueMoveOrderSpread } from "../units/combat.js";

function testPathAroundNeutralWall(): void {
  const state = createSkirmishBuildState("triad", "block");
  const start = { gx: 75, gy: 66 };
  const goal = { gx: 105, gy: 66 };
  assert.ok(!hasCellLineOfSight(state, start.gx, start.gy, goal.gx, goal.gy));

  const path = findCellPath(state, start.gx, start.gy, goal.gx, goal.gy);
  assert.ok(path && path.length > 4, "should route through mid lane");

  for (const cell of path) {
    assert.ok(isNavCellWalkable(state, cell.gx, cell.gy), `cell ${cell.gx},${cell.gy} must be walkable`);
  }
}

function testNorthLaneConnects(): void {
  const state = createSkirmishBuildState("triad", "block");
  const path = findCellPath(state, 78, 22, 102, 22);
  assert.ok(path && path.length >= 2, "north lane should connect human border to AI border");
}

function testSouthLaneConnects(): void {
  const state = createSkirmishBuildState("triad", "block");
  const path = findCellPath(state, 78, 106, 102, 106);
  assert.ok(path && path.length >= 2, "south lane should connect");
}

function testWorldPathEndpoints(): void {
  const state = createSkirmishBuildState("triad", "block");
  const fromX = 75 * CELL_PX + 24;
  const fromY = 66 * CELL_PX + 24;
  const toX = 105 * CELL_PX + 24;
  const toY = 66 * CELL_PX + 24;
  const wps = findWorldPath(state, fromX, fromY, toX, toY);
  assert.ok(wps.length >= 2);
  const last = wps[wps.length - 1]!;
  assert.ok(Math.abs(last.x - toX) < 1 && Math.abs(last.y - toY) < 1);
}

function testMoveOrderAssignsNav(): void {
  const state = createSkirmishBuildState("triad", "block");
  const u = state.units[0];
  if (!u) return;
  const fromX = 75 * CELL_PX;
  const fromY = 66 * CELL_PX;
  const toX = 105 * CELL_PX;
  const toY = 66 * CELL_PX;
  const units = issueMoveOrderSpread(
    { ...state, units: [{ ...u, x: fromX, y: fromY }] },
    [{ ...u, x: fromX, y: fromY }],
    new Set([u.instanceId]),
    toX,
    toY,
  );
  const moved = units[0]!;
  assert.ok(moved.navWaypoints && moved.navWaypoints.length >= 2);
}

testPathAroundNeutralWall();
testNorthLaneConnects();
testSouthLaneConnects();
testWorldPathEndpoints();
testMoveOrderAssignsNav();
