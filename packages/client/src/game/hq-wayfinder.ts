import { CELL_PX } from "@rtsbrowser/shared";
import { el } from "../ui/dom.js";
import type { MapCamera } from "./map-camera.js";

const EDGE_INSET = 48;

export interface HqWayfinderHandle {
  update(): void;
  destroy(): void;
}

/** On-screen edge arrow pointing to the player's HQ when it is off-screen. */
export function attachHqWayfinder(
  viewport: HTMLElement,
  options: {
    getHqCell: () => { gx: number; gy: number } | null;
    getCamera: () => MapCamera;
    onGoHome: () => void;
  },
): HqWayfinderHandle {
  const root = el("button", "hq-wayfinder hidden");
  root.type = "button";
  root.title = "Jump to your HQ";
  root.append(el("span", "hq-wayfinder-arrow", ["▶"]));
  const label = el("span", "hq-wayfinder-label", ["Your HQ"]);
  root.append(label);
  viewport.append(root);

  root.onclick = (e) => {
    e.stopPropagation();
    options.onGoHome();
  };

  const update = () => {
    const hq = options.getHqCell();
    if (!hq) {
      root.classList.add("hidden");
      return;
    }

    const rect = viewport.getBoundingClientRect();
    if (rect.width < 32 || rect.height < 32) return;

    const cam = options.getCamera();
    const hqPxX = hq.gx * CELL_PX + CELL_PX;
    const hqPxY = hq.gy * CELL_PX + CELL_PX;
    const screenX = (hqPxX - cam.x) * cam.zoom;
    const screenY = (hqPxY - cam.y) * cam.zoom;

    const pad = 56;
    const onScreen =
      screenX >= pad &&
      screenX <= rect.width - pad &&
      screenY >= pad &&
      screenY <= rect.height - pad;

    if (onScreen) {
      root.classList.add("hidden");
      return;
    }

    root.classList.remove("hidden");

    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const dx = screenX - cx;
    const dy = screenY - cy;
    const angle = Math.atan2(dy, dx);

    const margin = EDGE_INSET;
    const halfW = rect.width / 2 - margin;
    const halfH = rect.height / 2 - margin;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const tX = cos !== 0 ? halfW / Math.abs(cos) : Infinity;
    const tY = sin !== 0 ? halfH / Math.abs(sin) : Infinity;
    const t = Math.min(tX, tY);

    const x = cx + cos * t;
    const y = cy + sin * t;

    root.style.left = `${x}px`;
    root.style.top = `${y}px`;
    root.style.transform = `translate(-50%, -50%) rotate(${angle}rad)`;
    label.textContent = "Your HQ →";
  };

  return {
    update,
    destroy() {
      root.remove();
    },
  };
}
