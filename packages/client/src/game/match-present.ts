import { BUILD_TICK_MS } from "@rtsbrowser/shared";
import type { Unit } from "@rtsbrowser/shared";
import { unitDisplayOffset } from "./unit-visuals.js";

export interface UnitDisplayNode {
  root: HTMLElement;
  hpFill: HTMLElement;
}

/**
 * Interpolate unit sprites at display refresh rate while sim stays at BUILD_TICK_MS.
 * Call captureBeforeTick() immediately before each sim advance.
 */
export function createUnitInterpolator(getUnits: () => Unit[]) {
  const prevPos = new Map<string, { x: number; y: number }>();
  let snapAt = performance.now();
  let running = false;
  let rafId = 0;

  const captureBeforeTick = () => {
    const live = new Set<string>();
    for (const u of getUnits()) {
      if (u.hp <= 0) continue;
      live.add(u.instanceId);
      prevPos.set(u.instanceId, { x: u.x, y: u.y });
    }
    for (const id of prevPos.keys()) {
      if (!live.has(id)) prevPos.delete(id);
    }
    snapAt = performance.now();
  };

  const applyPose = (nodes: Map<string, UnitDisplayNode>, now: number) => {
    const alpha = Math.min(1, (now - snapAt) / BUILD_TICK_MS);

    for (const u of getUnits()) {
      if (u.hp <= 0) continue;
      const entry = nodes.get(u.instanceId);
      if (!entry) continue;

      const from = prevPos.get(u.instanceId);
      const x = from ? from.x + (u.x - from.x) * alpha : u.x;
      const y = from ? from.y + (u.y - from.y) * alpha : u.y;
      const off = unitDisplayOffset(u.defId);
      entry.root.style.transform = `translate3d(${x - off}px, ${y - off}px, 0)`;
    }
  };

  const snapAll = (nodes: Map<string, UnitDisplayNode>) => {
    for (const u of getUnits()) {
      if (u.hp <= 0) continue;
      const entry = nodes.get(u.instanceId);
      if (!entry) continue;
      const off = unitDisplayOffset(u.defId);
      entry.root.style.transform = `translate3d(${u.x - off}px, ${u.y - off}px, 0)`;
    }
  };

  const start = (nodes: Map<string, UnitDisplayNode>) => {
    if (running) return;
    running = true;
    const frame = (now: number) => {
      if (!running) return;
      applyPose(nodes, now);
      rafId = requestAnimationFrame(frame);
    };
    rafId = requestAnimationFrame(frame);
  };

  const stop = () => {
    running = false;
    cancelAnimationFrame(rafId);
  };

  return { captureBeforeTick, start, stop, snapAll };
}
