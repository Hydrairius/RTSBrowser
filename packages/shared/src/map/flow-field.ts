import { MAP_COLS, MAP_ROWS } from "../structures/defs.js";
import type { BuildSimState } from "../structures/building.js";
import {
  cellFromIndex,
  cellIndex,
} from "./nav-grid.js";
import {
  cellTraversalCost,
  isNavCellWalkable,
  nearestWalkableCell,
} from "./pathfind.js";

const NEIGHBOR_DX = [1, -1, 0, 0, 1, 1, -1, -1];
const NEIGHBOR_DY = [0, 0, 1, -1, 1, -1, 1, -1];
const NEIGHBOR_COST = [1, 1, 1, 1, 1.414, 1.414, 1.414, 1.414];

const GRID_SIZE = MAP_COLS * MAP_ROWS;

export interface FlowField {
  goalGx: number;
  goalGy: number;
  /** Cost-to-goal per cell; unreachable cells stay at Infinity. */
  integrate: Float32Array;
  /** Best downhill step per cell (-1, 0, or 1). */
  flowDx: Int8Array;
  flowDy: Int8Array;
}

export function flowFieldGoalKey(goalGx: number, goalGy: number): string {
  return `${goalGx},${goalGy}`;
}

/** Bump when dynamic blockers change so cached fields rebuild. */
export function structureNavRevision(state: BuildSimState): number {
  let r = state.structures.length;
  for (const s of state.structures) {
    if (s.hp <= 0) continue;
    r += s.gx * 997 + s.gy * 17 + Math.floor(s.buildProgress * 100);
  }
  return r;
}

export function flowFieldCacheKey(
  state: BuildSimState,
  goalGx: number,
  goalGy: number,
): string {
  return `${flowFieldGoalKey(goalGx, goalGy)}:${structureNavRevision(state)}`;
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

/**
 * Integration + flow field from goal (Dijkstra on 8-neighbor grid).
 * Shares walkability and traversal costs with A*.
 */
export function buildFlowField(
  state: BuildSimState,
  goalGx: number,
  goalGy: number,
): FlowField | null {
  const goal = nearestWalkableCell(state, goalGx, goalGy);
  if (!goal) return null;

  const integrate = new Float32Array(GRID_SIZE);
  integrate.fill(Number.POSITIVE_INFINITY);

  const goalIdx = cellIndex(goal.gx, goal.gy);
  integrate[goalIdx] = 0;

  const closed = new Uint8Array(GRID_SIZE);
  const open = new MinHeap(integrate);
  open.push(goalIdx);

  while (open.size > 0) {
    const current = open.pop();
    if (closed[current]) continue;
    closed[current] = 1;
    const cost = integrate[current]!;

    const { gx: cx, gy: cy } = cellFromIndex(current);

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
      const tentative =
        cost + NEIGHBOR_COST[n]! + cellTraversalCost(state, ngx, ngy);
      if (tentative >= integrate[neighbor]!) continue;
      integrate[neighbor] = tentative;
      open.push(neighbor);
    }
  }

  const flowDx = new Int8Array(GRID_SIZE);
  const flowDy = new Int8Array(GRID_SIZE);

  for (let gy = 0; gy < MAP_ROWS; gy++) {
    for (let gx = 0; gx < MAP_COLS; gx++) {
      const idx = cellIndex(gx, gy);
      if (!isNavCellWalkable(state, gx, gy)) continue;
      if (integrate[idx]! === Number.POSITIVE_INFINITY) continue;
      if (idx === goalIdx) continue;

      let bestIdx = -1;
      let bestCost = integrate[idx]!;
      for (let n = 0; n < 8; n++) {
        const ngx = gx + NEIGHBOR_DX[n]!;
        const ngy = gy + NEIGHBOR_DY[n]!;
        if (!isNavCellWalkable(state, ngx, ngy)) continue;
        const nIdx = cellIndex(ngx, ngy);
        const c = integrate[nIdx]!;
        if (c < bestCost) {
          bestCost = c;
          bestIdx = nIdx;
        }
      }
      if (bestIdx < 0) continue;
      const next = cellFromIndex(bestIdx);
      flowDx[idx] = Math.sign(next.gx - gx) as -1 | 0 | 1;
      flowDy[idx] = Math.sign(next.gy - gy) as -1 | 0 | 1;
    }
  }

  return {
    goalGx: goal.gx,
    goalGy: goal.gy,
    integrate,
    flowDx,
    flowDy,
  };
}

/** Deterministic checksum for tests (reachable integration costs). */
export function flowFieldIntegrateChecksum(field: FlowField): number {
  let sum = 0;
  for (let i = 0; i < field.integrate.length; i++) {
    const v = field.integrate[i]!;
    if (v === Number.POSITIVE_INFINITY) continue;
    sum += Math.round(v * 1000);
  }
  return sum;
}

/** Unit direction toward lower integration (goal). */
export function sampleFlowDirection(
  field: FlowField,
  gx: number,
  gy: number,
): { dx: number; dy: number } | null {
  if (gx < 0 || gy < 0 || gx >= MAP_COLS || gy >= MAP_ROWS) return null;
  const idx = cellIndex(gx, gy);
  const fx = field.flowDx[idx]!;
  const fy = field.flowDy[idx]!;
  if (fx === 0 && fy === 0) return null;
  const len = Math.hypot(fx, fy) || 1;
  return { dx: fx / len, dy: fy / len };
}
