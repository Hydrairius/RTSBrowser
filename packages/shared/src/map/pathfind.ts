import { CELL_PX, MAP_COLS, MAP_ROWS, structureDef } from "../structures/defs.js";
import type { BuildSimState } from "../structures/building.js";
import {
  cellFromIndex,
  cellIndex,
  isCoreBarrierCell,
  isNearCoreBarrier,
  isStaticCellBlocked,
} from "./nav-grid.js";
import { UNIT_COLLISION_RADIUS } from "../units/collision.js";

const NEIGHBOR_DX = [1, -1, 0, 0, 1, 1, -1, -1];
const NEIGHBOR_DY = [0, 0, 1, -1, 1, -1, 1, -1];
const NEIGHBOR_COST = [1, 1, 1, 1, 1.414, 1.414, 1.414, 1.414];

const MAX_ASTAR_NODES = 12_000;

/** Extra A* cost for cells beside rock — keeps routes in lane centers. */
const WALL_PROXIMITY_COST = 5;

function structureBlocksCell(state: BuildSimState, gx: number, gy: number): boolean {
  for (const s of state.structures) {
    if (s.buildProgress < 1 || s.hp <= 0) continue;
    const fp = structureDef(s.defId).footprint;
    if (
      gx >= s.gx &&
      gx < s.gx + fp.w &&
      gy >= s.gy &&
      gy < s.gy + fp.h
    ) {
      return true;
    }
  }
  return false;
}

/** Extra step cost for lane-center bias (A* and flow fields). */
export function cellTraversalCost(state: BuildSimState, gx: number, gy: number): number {
  let extra = 0;
  if (isNearCoreBarrier(gx, gy)) extra += WALL_PROXIMITY_COST;
  for (const s of state.structures) {
    if (s.buildProgress < 1 || s.hp <= 0) continue;
    const fp = structureDef(s.defId).footprint;
    const pad = 1;
    if (
      gx >= s.gx - pad &&
      gx < s.gx + fp.w + pad &&
      gy >= s.gy - pad &&
      gy < s.gy + fp.h + pad &&
      !(gx >= s.gx && gx < s.gx + fp.w && gy >= s.gy && gy < s.gy + fp.h)
    ) {
      extra += WALL_PROXIMITY_COST;
      break;
    }
  }
  return extra;
}

export function isNavCellWalkable(state: BuildSimState, gx: number, gy: number): boolean {
  if (gx < 0 || gy < 0 || gx >= MAP_COLS || gy >= MAP_ROWS) return false;
  if (isStaticCellBlocked(gx, gy)) return false;
  return !structureBlocksCell(state, gx, gy);
}

export function worldToNavCell(x: number, y: number): { gx: number; gy: number } {
  return {
    gx: Math.min(MAP_COLS - 1, Math.max(0, Math.floor(x / CELL_PX))),
    gy: Math.min(MAP_ROWS - 1, Math.max(0, Math.floor(y / CELL_PX))),
  };
}

export function navCellCenterPx(gx: number, gy: number): { x: number; y: number } {
  return { x: (gx + 0.5) * CELL_PX, y: (gy + 0.5) * CELL_PX };
}

const WAYPOINT_WALL_BIAS_PX = UNIT_COLLISION_RADIUS + 6;

/** Nudge waypoint away from rock / blocked neighbors so units do not hug walls. */
export function navWaypointWorldPx(
  state: BuildSimState,
  gx: number,
  gy: number,
): { x: number; y: number } {
  const center = navCellCenterPx(gx, gy);
  let ox = 0;
  let oy = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = gx + dx;
      const ny = gy + dy;
      if (isNavCellWalkable(state, nx, ny) && !isCoreBarrierCell(nx, ny)) continue;
      ox -= dx;
      oy -= dy;
    }
  }
  const len = Math.hypot(ox, oy);
  if (len < 0.001) return center;
  const push = Math.min(WAYPOINT_WALL_BIAS_PX, len * 10);
  return {
    x: center.x + (ox / len) * push,
    y: center.y + (oy / len) * push,
  };
}

/** Nearest walkable cell (spiral search). */
export function nearestWalkableCell(
  state: BuildSimState,
  gx: number,
  gy: number,
  maxRadius = 14,
): { gx: number; gy: number } | null {
  if (isNavCellWalkable(state, gx, gy)) return { gx, gy };
  for (let r = 1; r <= maxRadius; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const nx = gx + dx;
        const ny = gy + dy;
        if (isNavCellWalkable(state, nx, ny)) return { gx: nx, gy: ny };
      }
    }
  }
  return null;
}

function heuristic(ax: number, ay: number, bx: number, by: number): number {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return Math.max(dx, dy) + (1.414 - 1) * Math.min(dx, dy);
}

class MinHeap {
  private readonly heap: number[] = [];
  private readonly score: Float32Array;

  constructor(score: Float32Array) {
    this.score = score;
  }

  push(index: number): void {
    this.heap.push(index);
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): number {
    const top = this.heap[0]!;
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.bubbleDown(0);
    }
    return top;
  }

  get size(): number {
    return this.heap.length;
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (this.score[this.heap[i]!]! >= this.score[this.heap[parent]!]!) break;
      [this.heap[i], this.heap[parent]] = [this.heap[parent]!, this.heap[i]!];
      i = parent;
    }
  }

  private bubbleDown(i: number): void {
    const n = this.heap.length;
    while (true) {
      const left = i * 2 + 1;
      const right = left + 1;
      let smallest = i;
      if (left < n && this.score[this.heap[left]!]! < this.score[this.heap[smallest]!]!) {
        smallest = left;
      }
      if (right < n && this.score[this.heap[right]!]! < this.score[this.heap[smallest]!]!) {
        smallest = right;
      }
      if (smallest === i) break;
      [this.heap[i], this.heap[smallest]] = [this.heap[smallest]!, this.heap[i]!];
      i = smallest;
    }
  }
}

/** A* on the skirmish grid (static barriers baked; structures dynamic). */
export function findCellPath(
  state: BuildSimState,
  fromGx: number,
  fromGy: number,
  toGx: number,
  toGy: number,
): { gx: number; gy: number }[] | null {
  if (fromGx === toGx && fromGy === toGy) return [{ gx: toGx, gy: toGy }];

  const size = MAP_COLS * MAP_ROWS;
  const gScore = new Float32Array(size);
  const fScore = new Float32Array(size);
  const cameFrom = new Int32Array(size);
  const closed = new Uint8Array(size);
  gScore.fill(Number.POSITIVE_INFINITY);
  fScore.fill(Number.POSITIVE_INFINITY);
  cameFrom.fill(-1);

  const start = cellIndex(fromGx, fromGy);
  const goal = cellIndex(toGx, toGy);
  gScore[start] = 0;
  fScore[start] = heuristic(fromGx, fromGy, toGx, toGy);

  const open = new MinHeap(fScore);
  open.push(start);

  let expanded = 0;

  while (open.size > 0 && expanded < MAX_ASTAR_NODES) {
    const current = open.pop();
    expanded++;
    if (current === goal) {
      const path: { gx: number; gy: number }[] = [];
      let cur: number = goal;
      while (cur !== -1) {
        path.push(cellFromIndex(cur));
        if (cur === start) break;
        cur = cameFrom[cur]!;
      }
      path.reverse();
      return path;
    }
    if (closed[current]) continue;
    closed[current] = 1;

    const { gx: cx, gy: cy } = cellFromIndex(current);
    const gCur = gScore[current]!;

    for (let n = 0; n < 8; n++) {
      const ngx = cx + NEIGHBOR_DX[n]!;
      const ngy = cy + NEIGHBOR_DY[n]!;
      if (!isNavCellWalkable(state, ngx, ngy)) continue;
      if (n >= 4) {
        const ax = cx + NEIGHBOR_DX[n]!;
        const ay = cy;
        const bx = cx;
        const by = cy + NEIGHBOR_DY[n]!;
        if (!isNavCellWalkable(state, ax, ay) || !isNavCellWalkable(state, bx, by)) {
          continue;
        }
      }

      const neighbor = cellIndex(ngx, ngy);
      if (closed[neighbor]) continue;

      const tentative =
        gCur + NEIGHBOR_COST[n]! + cellTraversalCost(state, ngx, ngy);
      if (tentative >= gScore[neighbor]!) continue;

      cameFrom[neighbor] = current;
      gScore[neighbor] = tentative;
      fScore[neighbor] = tentative + heuristic(ngx, ngy, toGx, toGy);
      open.push(neighbor);
    }
  }

  return null;
}

export function hasCellLineOfSight(
  state: BuildSimState,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): boolean {
  let x0 = ax;
  let y0 = ay;
  const x1 = bx;
  const y1 = by;
  const dx = Math.abs(x1 - x0);
  const dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;

  while (true) {
    if (!isNavCellWalkable(state, x0, y0)) return false;
    if (x0 === x1 && y0 === y1) return true;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x0 += sx;
    }
    if (e2 < dx) {
      err += dx;
      y0 += sy;
    }
  }
}

function simplifyCellPath(
  state: BuildSimState,
  path: { gx: number; gy: number }[],
): { gx: number; gy: number }[] {
  if (path.length <= 2) return path;
  const out: { gx: number; gy: number }[] = [path[0]!];
  let anchor = 0;
  for (let i = 1; i < path.length; i++) {
    const cell = path[i]!;
    const isLast = i === path.length - 1;
    if (!isLast && hasCellLineOfSight(state, path[anchor]!.gx, path[anchor]!.gy, cell.gx, cell.gy)) {
      continue;
    }
    if (!isLast) {
      out.push(cell);
      anchor = i;
    }
  }
  out.push(path[path.length - 1]!);
  return out;
}

/** World-space waypoints around walls and buildings. */
export function findWorldPath(
  state: BuildSimState,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
): { x: number; y: number }[] {
  const startCell = worldToNavCell(fromX, fromY);
  const goalCell = worldToNavCell(toX, toY);
  const start = nearestWalkableCell(state, startCell.gx, startCell.gy);
  const goal = nearestWalkableCell(state, goalCell.gx, goalCell.gy);
  if (!start || !goal) return [];

  if (hasCellLineOfSight(state, start.gx, start.gy, goal.gx, goal.gy)) {
    return [{ x: toX, y: toY }];
  }

  const raw = findCellPath(state, start.gx, start.gy, goal.gx, goal.gy);
  if (!raw || raw.length === 0) return [];

  const cells = simplifyCellPath(state, raw);
  const waypoints: { x: number; y: number }[] = [];
  for (let i = 1; i < cells.length; i++) {
    const cell = cells[i]!;
    waypoints.push(navWaypointWorldPx(state, cell.gx, cell.gy));
  }
  if (isNavCellWalkable(state, goal.gx, goal.gy)) {
    waypoints.push(navWaypointWorldPx(state, goal.gx, goal.gy));
  } else {
    waypoints.push({ x: toX, y: toY });
  }
  return waypoints;
}
