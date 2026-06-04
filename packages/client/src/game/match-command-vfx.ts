import { unitDef, type TargetKind, type UnitDefId } from "@rtsbrowser/shared";
import type { FactionId } from "../data/factions.js";
import { applyFactionTheme } from "./faction-shapes.js";
import { el } from "../ui/dom.js";

const MARKER_LIFETIME_MS = 2200;
const LINE_LIFETIME_MS = 1400;
const MAX_MOVE_LINES = 8;

export interface CommandVfxHandle {
  showMove(worldX: number, worldY: number, fromPositions: { x: number; y: number }[]): void;
  showAttack(worldX: number, worldY: number, targetKind: TargetKind): void;
  showDeploy(worldX: number, worldY: number, unitDefId: UnitDefId): void;
  destroy(): void;
}

export function mountCommandVfx(
  worldLayer: HTMLElement,
  humanFaction: FactionId,
): CommandVfxHandle {
  const layer = el("div", "match-command-vfx");
  const linesSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  linesSvg.setAttribute("class", "command-lines-svg");
  const markersLayer = el("div", "command-markers-layer");
  layer.append(linesSvg, markersLayer);
  worldLayer.append(layer);

  const removeLater = (node: HTMLElement, ms: number) => {
    window.setTimeout(() => node.remove(), ms);
  };

  const spawnMarker = (className: string, worldX: number, worldY: number) => {
    const m = el("div", className);
    applyFactionTheme(m, humanFaction);
    m.style.left = `${worldX}px`;
    m.style.top = `${worldY}px`;
    markersLayer.append(m);
    removeLater(m, MARKER_LIFETIME_MS);
    return m;
  };

  const drawLines = (fromPositions: { x: number; y: number }[], toX: number, toY: number) => {
    const n = fromPositions.length;
    if (n === 0) return;
    const step = n <= MAX_MOVE_LINES ? 1 : Math.ceil(n / MAX_MOVE_LINES);
    let drawn = 0;
    for (let i = 0; i < n && drawn < MAX_MOVE_LINES; i += step) {
      const from = fromPositions[i]!;
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("class", "command-move-line");
      line.setAttribute("x1", String(Math.round(from.x)));
      line.setAttribute("y1", String(Math.round(from.y)));
      line.setAttribute("x2", String(Math.round(toX)));
      line.setAttribute("y2", String(Math.round(toY)));
      linesSvg.append(line);
      window.setTimeout(() => line.remove(), LINE_LIFETIME_MS);
      drawn++;
    }
    while (linesSvg.childNodes.length > MAX_MOVE_LINES) {
      linesSvg.firstChild?.remove();
    }
  };

  return {
    showMove(worldX, worldY, fromPositions) {
      spawnMarker("command-marker command-marker-move", worldX, worldY);
      if (fromPositions.length > 0 && fromPositions.length <= 24) {
        drawLines(fromPositions, worldX, worldY);
      }
    },

    showAttack(worldX, worldY, targetKind) {
      const kindClass =
        targetKind === "structure" ? "command-marker-structure" : "command-marker-unit";
      spawnMarker(`command-marker command-marker-attack ${kindClass}`, worldX, worldY);
    },

    showDeploy(worldX, worldY, unitDefId) {
      const burst = el("div", `command-deploy-burst deploy-${unitDefId}`);
      applyFactionTheme(burst, humanFaction);
      burst.style.left = `${worldX}px`;
      burst.style.top = `${worldY}px`;
      const label = el("span", "command-deploy-label", [unitDef(unitDefId).displayName]);
      burst.append(label);
      markersLayer.append(burst);
      removeLater(burst, 900);
    },

    destroy() {
      layer.remove();
    },
  };
}
