/** Live match state for browser console and agent debugging (dev only). */

export interface MatchDebugSnapshot {
  at: string;
  selectedBuild: string | null;
  paused: boolean;
  introEnabled: boolean;
  camera: { x: number; y: number };
  viewport: { width: number; height: number };
  snapCell: { gx: number; gy: number } | null;
  hq: { gx: number; gy: number } | null;
  structureCount: number;
  unitCount: number;
  projectileCount: number;
  matter: number;
  simTick: number;
  perf: {
    lastSimMs: number;
    lastRenderMs: number;
    avgSimMs: number;
    avgRenderMs: number;
    simFps: number;
  };
  structures: { defId: string; ownerId: string; gx: number; gy: number; progress: number }[];
}

type Getter = () => MatchDebugSnapshot;

let getter: Getter | null = null;

export function registerMatchDebug(fn: Getter): void {
  getter = fn;
  if (!import.meta.env.DEV) return;
  const w = window as unknown as { __RTS_MATCH_DEBUG__?: () => MatchDebugSnapshot };
  if (!w.__RTS_MATCH_DEBUG__) {
    w.__RTS_MATCH_DEBUG__ = () => getter?.() ?? emptySnapshot();
  }
}

export function unregisterMatchDebug(): void {
  getter = null;
  if (import.meta.env.DEV) {
    delete (window as unknown as { __RTS_MATCH_DEBUG__?: Getter }).__RTS_MATCH_DEBUG__;
  }
}

function emptySnapshot(): MatchDebugSnapshot {
  return {
    at: new Date().toISOString(),
    selectedBuild: null,
    paused: false,
    introEnabled: false,
    camera: { x: 0, y: 0 },
    viewport: { width: 0, height: 0 },
    snapCell: null,
    hq: null,
    structureCount: 0,
    unitCount: 0,
    projectileCount: 0,
    matter: 0,
    simTick: 0,
    perf: { lastSimMs: 0, lastRenderMs: 0, avgSimMs: 0, avgRenderMs: 0, simFps: 0 },
    structures: [],
  };
}
