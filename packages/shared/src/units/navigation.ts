import { CELL_PX } from "../structures/defs.js";
import type { BuildSimState } from "../structures/building.js";
import { findWorldPath, hasCellLineOfSight, worldToNavCell } from "../map/pathfind.js";
import { moveUnitToward } from "./collision.js";
import { distPx } from "./geometry.js";
import type { Unit } from "./types.js";

const WAYPOINT_REACH_PX = CELL_PX * 0.42;
const GOAL_REACH_MULT = 1.25;

export function clearUnitNav(unit: Unit): Unit {
  return {
    ...unit,
    navWaypoints: undefined,
    navWaypointIndex: undefined,
    navGoalKey: undefined,
    navUseFlow: undefined,
  };
}

export function navGoalKey(goalX: number, goalY: number): string {
  const c = worldToNavCell(goalX, goalY);
  return `${c.gx},${c.gy}`;
}

function needsNewPath(unit: Unit, goalX: number, goalY: number): boolean {
  const key = navGoalKey(goalX, goalY);
  if (unit.navGoalKey !== key) return true;
  if (!unit.navWaypoints?.length) return true;
  return false;
}

export function ensureUnitPath(
  state: BuildSimState,
  unit: Unit,
  goalX: number,
  goalY: number,
): Unit {
  if (!needsNewPath(unit, goalX, goalY)) return unit;

  const from = worldToNavCell(unit.x, unit.y);
  const to = worldToNavCell(goalX, goalY);
  if (hasCellLineOfSight(state, from.gx, from.gy, to.gx, to.gy)) {
    return {
      ...unit,
      navWaypoints: [{ x: goalX, y: goalY }],
      navWaypointIndex: 0,
      navGoalKey: navGoalKey(goalX, goalY),
    };
  }

  const waypoints = findWorldPath(state, unit.x, unit.y, goalX, goalY);
  if (waypoints.length === 0) {
    return {
      ...clearUnitNav(unit),
      navGoalKey: navGoalKey(goalX, goalY),
    };
  }

  return {
    ...unit,
    navWaypoints: waypoints,
    navWaypointIndex: 0,
    navGoalKey: navGoalKey(goalX, goalY),
  };
}

/** Step target along baked route (or final goal). */
export function navStepTarget(unit: Unit, goalX: number, goalY: number): { x: number; y: number } {
  const wps = unit.navWaypoints;
  if (!wps?.length) return { x: goalX, y: goalY };
  const idx = Math.min(unit.navWaypointIndex ?? 0, wps.length - 1);
  return wps[idx]!;
}

export function advanceNavWaypoint(unit: Unit, x: number, y: number): Unit {
  const wps = unit.navWaypoints;
  if (!wps?.length) return unit;
  const idx = unit.navWaypointIndex ?? 0;
  const wp = wps[idx];
  if (!wp) return unit;
  if (distPx(x, y, wp.x, wp.y) > WAYPOINT_REACH_PX) return unit;
  if (idx >= wps.length - 1) return unit;
  return { ...unit, navWaypointIndex: idx + 1 };
}

/** Move one tick using nav mesh waypoints when needed. */
export function moveUnitWithNav(
  state: BuildSimState,
  unit: Unit,
  goalX: number,
  goalY: number,
  speed: number,
): { unit: Unit; arrived: boolean } {
  let u = ensureUnitPath(state, unit, goalX, goalY);
  const target = navStepTarget(u, goalX, goalY);
  const onNav = Boolean(u.navWaypoints?.length);
  const moved = moveUnitToward(state, u.instanceId, u.x, u.y, target.x, target.y, speed, {
    followNavPath: onNav,
  });
  const stuck =
    distPx(u.x, u.y, moved.x, moved.y) < 0.01 &&
    distPx(moved.x, moved.y, goalX, goalY) > speed * GOAL_REACH_MULT;
  if (stuck && onNav) {
    u = { ...u, navWaypoints: undefined, navWaypointIndex: undefined };
  }
  u = { ...u, x: moved.x, y: moved.y };
  u = advanceNavWaypoint(u, moved.x, moved.y);

  const atGoal = distPx(moved.x, moved.y, goalX, goalY) <= speed * GOAL_REACH_MULT;
  const lastWp = u.navWaypoints?.length
    ? (u.navWaypointIndex ?? 0) >= u.navWaypoints.length - 1
    : true;
  const arrived = moved.arrived && atGoal && lastWp;

  if (arrived) {
    u = clearUnitNav(u);
  }

  return { unit: u, arrived };
}

/** True when a straight line crosses a blocked nav cell. */
export function directPathBlocked(
  state: BuildSimState,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): boolean {
  const from = worldToNavCell(fromX, fromY);
  const to = worldToNavCell(toX, toY);
  return !hasCellLineOfSight(state, from.gx, from.gy, to.gx, to.gy);
}
