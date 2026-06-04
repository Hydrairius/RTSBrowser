import { CELL_PX } from "../structures/defs.js";
import type { BuildSimState } from "../structures/building.js";
import {
  buildFlowField,
  flowFieldCacheKey,
  sampleFlowDirection,
  type FlowField,
} from "../map/flow-field.js";
import { navCellCenterPx, worldToNavCell } from "../map/pathfind.js";
import { moveUnitToward } from "./collision.js";
import { distPx } from "./geometry.js";
import type { Unit } from "./types.js";

/** Squads at or above this size share one flow field on move orders. */
export const FLOW_SQUAD_MIN_UNITS = 6;

const MAX_CACHED_FLOW_FIELDS = 8;

const FLOW_LOCAL_GOAL_PX = CELL_PX * 2.5;

function trimFlowCache(cache: Map<string, FlowField>): Map<string, FlowField> {
  if (cache.size <= MAX_CACHED_FLOW_FIELDS) return cache;
  const keys = [...cache.keys()];
  const next = new Map<string, FlowField>();
  for (const key of keys.slice(-MAX_CACHED_FLOW_FIELDS)) {
    const field = cache.get(key);
    if (field) next.set(key, field);
  }
  return next;
}

export function getOrBuildFlowField(
  state: BuildSimState,
  goalGx: number,
  goalGy: number,
): { state: BuildSimState; field: FlowField | null } {
  const key = flowFieldCacheKey(state, goalGx, goalGy);
  const existing = state.flowFields?.get(key);
  if (existing) return { state, field: existing };

  const field = buildFlowField(state, goalGx, goalGy);
  if (!field) return { state, field: null };

  let cache = new Map(state.flowFields ?? []);
  cache.set(key, field);
  cache = trimFlowCache(cache);
  return { state: { ...state, flowFields: cache }, field };
}

export function clearFlowFields(state: BuildSimState): BuildSimState {
  if (!state.flowFields?.size) return state;
  return { ...state, flowFields: undefined };
}

/** Flow-field step: global downhill + final spread offset; local separation stays in combat tick. */
export function moveUnitWithFlow(
  state: BuildSimState,
  unit: Unit,
  goalX: number,
  goalY: number,
  speed: number,
): { state: BuildSimState; unit: Unit; arrived: boolean } {
  const goalCell = worldToNavCell(goalX, goalY);
  const built = getOrBuildFlowField(state, goalCell.gx, goalCell.gy);
  let nextState = built.state;
  const field = built.field;

  const distToGoal = distPx(unit.x, unit.y, goalX, goalY);
  if (distToGoal <= speed * 1.25) {
    return { state: nextState, unit, arrived: true };
  }

  let tx = goalX;
  let ty = goalY;

  if (field && distToGoal > FLOW_LOCAL_GOAL_PX) {
    const cell = worldToNavCell(unit.x, unit.y);
    const dir = sampleFlowDirection(field, cell.gx, cell.gy);
    if (dir) {
      const step = CELL_PX * 0.85;
      tx = unit.x + dir.dx * step;
      ty = unit.y + dir.dy * step;
    } else {
      const center = navCellCenterPx(field.goalGx, field.goalGy);
      tx = center.x;
      ty = center.y;
    }
  }

  const moved = moveUnitToward(nextState, unit.instanceId, unit.x, unit.y, tx, ty, speed, {
    followNavPath: true,
  });

  const arrived =
    moved.arrived && distPx(moved.x, moved.y, goalX, goalY) <= speed * 1.25;

  return {
    state: nextState,
    unit: { ...unit, x: moved.x, y: moved.y },
    arrived,
  };
}
