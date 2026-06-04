import { unitDef, type TargetKind, type UnitDefId } from "@rtsbrowser/shared";
import type { FactionId } from "../data/factions.js";
import { applyFactionTheme } from "./faction-shapes.js";
import { el } from "../ui/dom.js";

const MARKER_LIFETIME_MS = 2200;

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
  const markersLayer = el("div", "command-markers-layer");
  layer.append(markersLayer);
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

  return {
    showMove(worldX, worldY) {
      spawnMarker("command-marker command-marker-move", worldX, worldY);
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
