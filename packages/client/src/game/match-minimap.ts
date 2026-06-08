import {
  AI_HQ_SPAWN,
  AI_PLAYER_ID,
  CELL_PX,
  HUMAN_HQ_SPAWN,
  HUMAN_PLAYER_ID,
  neutralZoneBounds,
  SKIRMISH_MAP_BARRIERS,
  SKIRMISH_FLUX_OBJECTIVES,
  SKIRMISH_MATTER_DEPOSITS,
  zoneForRole,
  type PlayerVision,
} from "@rtsbrowser/shared";
import type { UnitDefId } from "@rtsbrowser/shared";
import { factionById, type FactionId } from "../data/factions.js";
import { factionThemeClass } from "./faction-shapes.js";
import { el } from "../ui/dom.js";
import { mountMinimapFog } from "./match-fog.js";
import type { MapCamera } from "./map-camera.js";
import { clampCamera, visibleWorldSize, worldSizePx } from "./map-camera.js";

export interface MinimapStructure {
  gx: number;
  gy: number;
  defId: string;
  ownerId: string;
  factionId: FactionId;
  hp: number;
}

export interface MinimapUnit {
  instanceId: string;
  x: number;
  y: number;
  ownerId: string;
  factionId: FactionId;
  defId: UnitDefId;
  hp: number;
}

export interface MinimapHandle {
  update(
    camera: MapCamera,
    viewportW: number,
    viewportH: number,
    structures: MinimapStructure[],
    units: MinimapUnit[],
  ): void;
  destroy(): void;
}

/** Minimap canvas size (px) — larger tactical view in top-right card. */
export const MINIMAP_WIDTH_PX = 228;
export const MINIMAP_HEIGHT_PX = 171;

export function mountMinimap(
  container: HTMLElement,
  options: {
    getCamera: () => MapCamera;
    onNavigate: (cam: MapCamera) => void;
    onFocusHq?: () => void;
    onFocusEnemy?: () => void;
    getHumanVision?: () => PlayerVision | undefined;
  },
): MinimapHandle {
  const world = worldSizePx();
  const scaleX = MINIMAP_WIDTH_PX / world.width;
  const scaleY = MINIMAP_HEIGHT_PX / world.height;

  const root = el("div", "minimap");
  const toolbar = el("div", "minimap-toolbar");
  const btnHq = button("Your HQ", "minimap-jump-btn");
  const btnEnemy = button("Enemy HQ", "minimap-jump-btn minimap-jump-enemy");
  toolbar.append(btnHq, btnEnemy);
  root.append(toolbar);

  const canvas = el("div", "minimap-map");
  canvas.title = "Click to move view · white box = camera";

  const humanZone = zoneForRole("human");
  const aiZone = zoneForRole("ai");
  const neutral = neutralZoneBounds();

  const zoneHuman = el("div", "minimap-zone minimap-zone-human");
  zoneHuman.style.left = `${humanZone.minGx * CELL_PX * scaleX}px`;
  zoneHuman.style.top = `${humanZone.minGy * CELL_PX * scaleY}px`;
  zoneHuman.style.width = `${(humanZone.maxGx - humanZone.minGx) * CELL_PX * scaleX}px`;
  zoneHuman.style.height = `${(humanZone.maxGy - humanZone.minGy) * CELL_PX * scaleY}px`;

  const zoneAi = el("div", "minimap-zone minimap-zone-ai");
  zoneAi.style.left = `${aiZone.minGx * CELL_PX * scaleX}px`;
  zoneAi.style.top = `${aiZone.minGy * CELL_PX * scaleY}px`;
  zoneAi.style.width = `${(aiZone.maxGx - aiZone.minGx) * CELL_PX * scaleX}px`;
  zoneAi.style.height = `${(aiZone.maxGy - aiZone.minGy) * CELL_PX * scaleY}px`;

  const zoneNeutral = el("div", "minimap-zone minimap-zone-neutral");
  zoneNeutral.style.left = `${neutral.minGx * CELL_PX * scaleX}px`;
  zoneNeutral.style.top = `${neutral.minGy * CELL_PX * scaleY}px`;
  zoneNeutral.style.width = `${(neutral.maxGx - neutral.minGx) * CELL_PX * scaleX}px`;
  zoneNeutral.style.height = `${(neutral.maxGy - neutral.minGy) * CELL_PX * scaleY}px`;

  const barriersLayer = el("div", "minimap-barriers");
  for (const b of SKIRMISH_MAP_BARRIERS) {
    const wall = el("div", "minimap-barrier");
    wall.style.left = `${b.gx * CELL_PX * scaleX}px`;
    wall.style.top = `${b.gy * CELL_PX * scaleY}px`;
    wall.style.width = `${b.w * CELL_PX * scaleX}px`;
    wall.style.height = `${b.h * CELL_PX * scaleY}px`;
    barriersLayer.append(wall);
  }

  const matterLayer = el("div", "minimap-matter-deposits");
  for (const d of SKIRMISH_MATTER_DEPOSITS) {
    const dot = el("div", "minimap-matter-deposit");
    dot.style.left = `${d.gx * CELL_PX * scaleX}px`;
    dot.style.top = `${d.gy * CELL_PX * scaleY}px`;
    dot.style.width = `${CELL_PX * scaleX}px`;
    dot.style.height = `${CELL_PX * scaleY}px`;
    matterLayer.append(dot);
  }

  const fluxLayer = el("div", "minimap-flux-objectives");
  for (const site of SKIRMISH_FLUX_OBJECTIVES) {
    const radius = site.radiusCells * CELL_PX;
    const marker = el("div", "minimap-flux-objective");
    marker.title = `${site.label} - Flux capture zone`;
    marker.style.left = `${(site.gx * CELL_PX + CELL_PX / 2) * scaleX}px`;
    marker.style.top = `${(site.gy * CELL_PX + CELL_PX / 2) * scaleY}px`;
    marker.style.width = `${radius * 2 * scaleX}px`;
    marker.style.height = `${radius * 2 * scaleY}px`;
    fluxLayer.append(marker);
  }

  const structuresLayer = el("div", "minimap-structures");
  const unitsLayer = el("div", "minimap-units");
  const fogLayer = el("div", "minimap-fog");
  const minimapFog = mountMinimapFog(fogLayer, scaleX, scaleY);
  const markersLayer = el("div", "minimap-markers");
  const viewportBox = el("div", "minimap-viewport");

  canvas.append(
    zoneHuman,
    zoneAi,
    zoneNeutral,
    barriersLayer,
    fluxLayer,
    matterLayer,
    structuresLayer,
    unitsLayer,
    fogLayer,
    markersLayer,
    viewportBox,
  );
  root.append(canvas);
  root.append(
    el("span", "minimap-legend", [
      "● blue = you · ● red = enemy · squares = buildings",
    ]),
  );
  container.replaceChildren(root);

  const humanMarker = el("div", "minimap-marker minimap-marker-human");
  humanMarker.title = "Your HQ — click to jump";

  const aiMarker = el("div", "minimap-marker minimap-marker-ai");
  aiMarker.title = "Enemy HQ — visible when scouted";
  aiMarker.classList.add("minimap-marker-hidden");

  markersLayer.append(humanMarker, aiMarker);

  btnHq.onclick = (e) => {
    e.stopPropagation();
    options.onFocusHq?.();
  };
  btnEnemy.onclick = (e) => {
    e.stopPropagation();
    options.onFocusEnemy?.();
  };

  humanMarker.onclick = (e) => {
    e.stopPropagation();
    options.onFocusHq?.();
  };
  aiMarker.onclick = (e) => {
    e.stopPropagation();
    options.onFocusEnemy?.();
  };

  let lastViewportW = 800;
  let lastViewportH = 600;
  let structureCacheKey = "";
  let unitCacheKey = "";
  const structureDots = new Map<string, HTMLElement>();
  const unitDots = new Map<string, HTMLElement>();

  const navigateToWorldPoint = (worldX: number, worldY: number) => {
    const zoom = options.getCamera().zoom;
    const vis = visibleWorldSize(lastViewportW, lastViewportH, zoom);
    options.onNavigate(
      clampCamera(
        { x: worldX - vis.width / 2, y: worldY - vis.height / 2, zoom },
        lastViewportW,
        lastViewportH,
      ),
    );
  };

  canvas.onclick = (e) => {
    if ((e.target as HTMLElement).closest(".minimap-marker, .minimap-jump-btn")) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    navigateToWorldPoint(x / scaleX, y / scaleY);
  };

  const placeHqMarker = (
    marker: HTMLElement,
    spawn: { gx: number; gy: number },
    live: MinimapStructure | undefined,
  ) => {
    const gx = live && live.hp > 0 ? live.gx + 1 : spawn.gx + 1;
    const gy = live && live.hp > 0 ? live.gy + 1 : spawn.gy + 1;
    marker.style.left = `${gx * CELL_PX * scaleX}px`;
    marker.style.top = `${gy * CELL_PX * scaleY}px`;
    marker.style.opacity = live && live.hp <= 0 ? "0.25" : "1";
  };

  return {
    update(camera, viewportW, viewportH, structures, units) {
      lastViewportW = viewportW;
      lastViewportH = viewportH;

      const vis = visibleWorldSize(viewportW, viewportH, camera.zoom);
      viewportBox.style.left = `${camera.x * scaleX}px`;
      viewportBox.style.top = `${camera.y * scaleY}px`;
      viewportBox.style.width = `${Math.max(14, vis.width * scaleX)}px`;
      viewportBox.style.height = `${Math.max(12, vis.height * scaleY)}px`;

      const humanHq = structures.find(
        (s) => s.ownerId === HUMAN_PLAYER_ID && s.defId === "hq",
      );
      const aiHq = structures.find((s) => s.ownerId === AI_PLAYER_ID && s.defId === "hq");
      placeHqMarker(humanMarker, HUMAN_HQ_SPAWN, humanHq);
      aiMarker.classList.toggle("minimap-marker-hidden", !aiHq);
      if (aiHq) placeHqMarker(aiMarker, AI_HQ_SPAWN, aiHq);

      minimapFog.update(options.getHumanVision?.());

      const structKey = structures
        .map((s) => `${s.gx},${s.gy},${s.defId},${s.ownerId},${s.hp}`)
        .join("|");
      if (structKey !== structureCacheKey) {
        structureCacheKey = structKey;
        const seen = new Set<string>();
        for (const s of structures) {
          if (s.defId === "hq" || s.hp <= 0) continue;
          const id = `${s.gx},${s.gy},${s.defId}`;
          seen.add(id);
          let dot = structureDots.get(id);
          if (!dot) {
            dot = el("div", `minimap-structure-dot ${factionThemeClass(s.factionId)}`);
            structureDots.set(id, dot);
            structuresLayer.append(dot);
          }
          dot.style.setProperty("--faction-color", factionById(s.factionId).color);
          const friendly = s.ownerId === HUMAN_PLAYER_ID;
          dot.classList.toggle("dot-human", friendly);
          dot.classList.toggle("dot-ai", !friendly);
          dot.title = `${friendly ? "Yours" : "Enemy"} · ${s.defId}`;
          dot.style.left = `${(s.gx + 0.5) * CELL_PX * scaleX}px`;
          dot.style.top = `${(s.gy + 0.5) * CELL_PX * scaleY}px`;
        }
        for (const [id, dot] of structureDots) {
          if (!seen.has(id)) {
            dot.remove();
            structureDots.delete(id);
          }
        }
      }

      const uKey = units.map((u) => `${u.instanceId},${u.x},${u.y},${u.hp}`).join("|");
      if (uKey !== unitCacheKey) {
        unitCacheKey = uKey;
        const seen = new Set<string>();
        for (const u of units) {
          if (u.hp <= 0) continue;
          seen.add(u.instanceId);
          let dot = unitDots.get(u.instanceId);
          if (!dot) {
            dot = el("div", "minimap-unit-dot");
            unitDots.set(u.instanceId, dot);
            unitsLayer.append(dot);
          }
          const friendly = u.ownerId === HUMAN_PLAYER_ID;
          dot.className = `minimap-unit-dot ${factionThemeClass(u.factionId)} unit-${u.defId}`;
          dot.classList.toggle("minimap-unit-friendly", friendly);
          dot.classList.toggle("minimap-unit-enemy", !friendly);
          dot.style.setProperty("--faction-color", factionById(u.factionId).color);
          dot.title = friendly ? "Your unit" : "Enemy unit";
          dot.style.left = `${u.x * scaleX}px`;
          dot.style.top = `${u.y * scaleY}px`;
        }
        for (const [id, dot] of unitDots) {
          if (!seen.has(id)) {
            dot.remove();
            unitDots.delete(id);
          }
        }
      }
    },
    destroy() {
      minimapFog.destroy();
      root.remove();
    },
  };
}

function button(label: string, className: string): HTMLButtonElement {
  const b = el("button", className, [label]);
  b.type = "button";
  return b;
}
