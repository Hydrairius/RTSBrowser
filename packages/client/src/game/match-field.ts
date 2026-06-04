import {
  advancePlayerVision,
  advanceSkirmishTick,
  AI_HQ_SPAWN,
  AI_PLAYER_ID,
  BUILD_TICK_MS,
  BUILDABLE_STRUCTURE_IDS,
  buildRangeCells,
  canPlaceStructure,
  canTrainAtBarracks,
  countPlayerUnits,
  isCombatUnit,
  PLAYER_UNIT_CAP,
  queueTrainAtHq,
  MAX_GENERATOR_WORKERS,
  workersAtStructure,
  workerActivelyBuilding,
  workersAssignedToGenerator,
  workersOperatingGenerator,
  CELL_PX,
  SKIRMISH_MAP_BARRIERS,
  SKIRMISH_MATTER_DEPOSITS,
  isMatterDepositConsumed,
  SKIRMISH_NAV_LANES,
  AI_HQ_BOWL,
  HUMAN_HQ_BOWL,
  hqBowlLabel,
  rectSizePx,
  checkSkirmishOutcome,
  createSkirmishBuildState,
  getPlayerHq,
  HUMAN_HQ_SPAWN,
  HUMAN_PLAYER_ID,
  issueStopOrder,
  neutralZoneBounds,
  placeStructure,
  barracksSpawnPoint,
  queueTrainAtBarracks,
  structureCenterPx,
  structureDef,
  unitDef,
  type TargetKind,
  worldSizePx,
  zoneForRole,
  type BuildSimState,
  type StructureDefId,
  type SkirmishOutcome,
  type Unit,
  type UnitDefId,
  getPlayerVision,
  humanHasExploredAiTerritory,
  isCellExplored,
  isCellVisible,
  isStructureVisibleToPlayer,
  isUnitVisibleToPlayer,
  worldToNavCell,
} from "@rtsbrowser/shared";
import {
  factionById,
  structureDisplayNameForFaction,
  type FactionId,
} from "../data/factions.js";
import { audio } from "../audio/index.js";
import { el } from "../ui/dom.js";
import { unitTooltipContent } from "./entity-tooltip.js";
import type { UnitPanelSnapshot, UnitPanelEntry } from "./hud-unit-panel.js";
import { UNIT_VISUAL } from "./unit-visuals.js";
import {
  registerMatchCameraFocus,
  registerMatchDebug,
  unregisterMatchDebug,
} from "../dev/match-debug.js";
import {
  attachMapCamera,
  clientToWorld,
  focusCameraWhenReady,
  placementCellFromWorld,
} from "./map-camera.js";
import { BUILD_PREVIEW } from "./build-preview.js";
import { applyFactionTheme } from "./faction-shapes.js";
import { applyUnitVisualClasses } from "./unit-visuals.js";
import { attachHqWayfinder, type HqWayfinderHandle } from "./hq-wayfinder.js";
import { mountMinimap, type MinimapHandle } from "./match-minimap.js";
import { mountCommandVfx } from "./match-command-vfx.js";
import { mountMatchTooltip } from "./match-tooltip.js";
import { createUnitInterpolator, type UnitDisplayNode } from "./match-present.js";
import {
  applyAttackCommand,
  applyGatherCommand,
  applyMoveCommand,
  applyProductionRallyCommand,
  barracksInScreenBox,
  pickEnemyTargetAt,
  pickDomTarget,
  pickFriendlyBarracksAt,
  pickFriendlyGeneratorAt,
  pickFriendlyHqAt,
  pickUnitAt,
  selectedWorkerIds,
  unitsInScreenBox,
  worldFromClient,
  worldHitRadiusForZoom,
} from "./match-input.js";
import { mountMatchFog } from "./match-fog.js";

export interface MatchFieldHandle {
  destroy(): void;
  setPaused(paused: boolean): void;
  selectBuild(id: StructureDefId | null): void;
  getBuildables(): StructureDefId[];
  focusHome(): void;
  getSelectedBarracksIds(): readonly string[];
  trainUnit(unitDefId: UnitDefId): boolean;
  trainWorker(): boolean;
  setHqSelected(selected: boolean): void;
  isHqSelected(): boolean;
  stopSelectedUnits(): void;
}

export function mountMatchField(
  viewport: HTMLElement,
  options: {
    humanFaction: FactionId;
    aiFaction: FactionId;
    onMatterChange: (matter: number) => void;
    onUnitCountChange?: (count: number, cap: number) => void;
    onBuildHint: (hint: string) => void;
    onPanHint?: (visible: boolean) => void;
    onSelectionHint?: (hint: string) => void;
    onUnitSelectionChange?: (snapshot: UnitPanelSnapshot | null) => void;
    onBarracksSelected?: (barracksIds: readonly string[]) => void;
    onHqSelected?: (selected: boolean) => void;
    onSkirmishEnd?: (outcome: Exclude<SkirmishOutcome, "ongoing">) => void;
    minimapHost?: HTMLElement;
    /** Simulation ticks (after intro). */
    simEnabled: () => boolean;
    /** Click-to-place (after intro). */
    canPlace: () => boolean;
    /** Pan / WASD (allowed during intro). */
    panEnabled: () => boolean;
  },
): MatchFieldHandle {
  const world = worldSizePx();

  let state = createSkirmishBuildState(options.humanFaction, options.aiFaction);
  let selectedBuild: StructureDefId | null = null;
  let snapGx = -1;
  let snapGy = -1;
  let paused = false;
  let lastClientX = 0;
  let lastClientY = 0;
  let hasPointer = false;
  const selectedUnitIds = new Set<string>();
  const selectedBarracksIds = new Set<string>();
  let hqSelected = false;
  let selecting = false;
  let selectStartX = 0;
  let selectStartY = 0;
  let skirmishEnded = false;
  let spaceHeld = false;

  const cameraLayer = el("div", "match-camera");
  const worldEl = el("div", "match-world");
  worldEl.style.width = `${world.width}px`;
  worldEl.style.height = `${world.height}px`;

  const humanZone = zoneForRole("human");
  const aiZone = zoneForRole("ai");
  const neutral = neutralZoneBounds();

  const zoneHuman = el("div", "map-zone map-zone-human");
  zoneHuman.style.left = `${humanZone.minGx * CELL_PX}px`;
  zoneHuman.style.top = `${humanZone.minGy * CELL_PX}px`;
  zoneHuman.style.width = `${(humanZone.maxGx - humanZone.minGx) * CELL_PX}px`;
  zoneHuman.style.height = `${(humanZone.maxGy - humanZone.minGy) * CELL_PX}px`;

  const zoneAi = el("div", "map-zone map-zone-ai");
  zoneAi.style.left = `${aiZone.minGx * CELL_PX}px`;
  zoneAi.style.top = `${aiZone.minGy * CELL_PX}px`;
  zoneAi.style.width = `${(aiZone.maxGx - aiZone.minGx) * CELL_PX}px`;
  zoneAi.style.height = `${(aiZone.maxGy - aiZone.minGy) * CELL_PX}px`;

  const zoneNeutral = el("div", "map-zone map-zone-neutral");
  zoneNeutral.style.left = `${neutral.minGx * CELL_PX}px`;
  zoneNeutral.style.top = `${neutral.minGy * CELL_PX}px`;
  zoneNeutral.style.width = `${(neutral.maxGx - neutral.minGx) * CELL_PX}px`;
  zoneNeutral.style.height = `${(neutral.maxGy - neutral.minGy) * CELL_PX}px`;

  const labelHuman = el("div", "map-zone-label map-zone-label-human", ["YOUR TERRITORY"]);
  labelHuman.style.left = `${humanZone.minGx * CELL_PX + 12}px`;
  labelHuman.style.top = `${humanZone.minGy * CELL_PX + 12}px`;

  const labelAi = el("div", "map-zone-label map-zone-label-ai", ["ENEMY TERRITORY"]);
  labelAi.style.left = `${aiZone.minGx * CELL_PX + 12}px`;
  labelAi.style.top = `${aiZone.minGy * CELL_PX + 12}px`;

  const labelNeutral = el("div", "map-zone-label map-zone-label-neutral", ["NO MAN'S LAND"]);
  labelNeutral.style.left = `${neutral.minGx * CELL_PX + 8}px`;
  labelNeutral.style.top = `${humanZone.minGy * CELL_PX + 12}px`;

  const navGuideLayer = el("div", "match-nav-guides");
  for (const lane of SKIRMISH_NAV_LANES) {
    const band = el("div", `map-nav-lane map-nav-lane-${lane.id}`);
    const size = rectSizePx(lane.band);
    band.style.left = `${size.left}px`;
    band.style.top = `${size.top}px`;
    band.style.width = `${size.width}px`;
    band.style.height = `${size.height}px`;
    band.title = lane.label;
    const label = el("span", "map-nav-lane-label", [lane.label]);
    band.append(label);
    navGuideLayer.append(band);
  }

  const humanBowl = el("div", "map-hq-bowl map-hq-bowl-human");
  const humanBowlSize = rectSizePx(HUMAN_HQ_BOWL);
  humanBowl.style.left = `${humanBowlSize.left}px`;
  humanBowl.style.top = `${humanBowlSize.top}px`;
  humanBowl.style.width = `${humanBowlSize.width}px`;
  humanBowl.style.height = `${humanBowlSize.height}px`;
  humanBowl.append(el("span", "map-hq-bowl-label", [hqBowlLabel("human")]));

  const aiBowl = el("div", "map-hq-bowl map-hq-bowl-ai");
  const aiBowlSize = rectSizePx(AI_HQ_BOWL);
  aiBowl.style.left = `${aiBowlSize.left}px`;
  aiBowl.style.top = `${aiBowlSize.top}px`;
  aiBowl.style.width = `${aiBowlSize.width}px`;
  aiBowl.style.height = `${aiBowlSize.height}px`;
  aiBowl.append(el("span", "map-hq-bowl-label", [hqBowlLabel("ai")]));

  navGuideLayer.append(humanBowl, aiBowl);

  const gridLayer = el("div", "match-grid");
  const barriersLayer = el("div", "match-barriers");
  for (const b of SKIRMISH_MAP_BARRIERS) {
    const wall = el("div", "map-barrier");
    wall.style.left = `${b.gx * CELL_PX}px`;
    wall.style.top = `${b.gy * CELL_PX}px`;
    wall.style.width = `${b.w * CELL_PX}px`;
    wall.style.height = `${b.h * CELL_PX}px`;
    wall.title = "Rock barrier";
    barriersLayer.append(wall);
  }
  const matterDepositsLayer = el("div", "match-matter-deposits");
  const matterDepositNodes = new Map<string, HTMLElement>();
  for (const d of SKIRMISH_MATTER_DEPOSITS) {
    const node = el("div", "map-matter-deposit");
    node.dataset.depositId = d.id;
    node.style.left = `${d.gx * CELL_PX}px`;
    node.style.top = `${d.gy * CELL_PX}px`;
    node.style.width = `${CELL_PX}px`;
    node.style.height = `${CELL_PX}px`;
    node.title = "Matter deposit — build generator here";
    matterDepositsLayer.append(node);
    matterDepositNodes.set(d.id, node);
  }
  const hqWaypointLayer = el("div", "hq-waypoint-layer");
  const fogHost = el("div", "match-fog");
  const structuresLayer = el("div", "match-structures");
  const unitsLayer = el("div", "match-units");
  const effectsLayer = el("div", "match-effects");
  const selectionBox = el("div", "match-selection-box");
  const P = BUILD_PREVIEW;
  const previewLayer = el("div", P.layer);
  const buildRangeLayer = el("div", P.range);
  const snapIndicator = el("div", `${P.snap} ${P.hidden}`);
  const ghost = el("div", `${P.ghost} ${P.hidden}`);
  const ghostFill = el("div", P.ghostFill);
  const ghostLabel = el("span", P.ghostLabel);
  const ghostHint = el("span", P.ghostHint, ["Click to place"]);
  ghost.append(ghostFill, ghostLabel, ghostHint);
  previewLayer.append(buildRangeLayer, snapIndicator, ghost);

  worldEl.append(
    zoneHuman,
    zoneAi,
    zoneNeutral,
    labelHuman,
    labelAi,
    labelNeutral,
    navGuideLayer,
    gridLayer,
    barriersLayer,
    matterDepositsLayer,
    hqWaypointLayer,
    fogHost,
    previewLayer,
    structuresLayer,
    unitsLayer,
    effectsLayer,
  );
  cameraLayer.append(worldEl);
  document.body.append(selectionBox);

  const panHint = el("div", "map-pan-hint", [
    "WASD or Space+drag (or middle-mouse drag) to pan · scroll to zoom · drag to select troops",
  ]);
  const zoomControls = el("div", "map-zoom-controls");
  const zoomLabel = el("span", "map-zoom-label", ["100%"]);
  const zoomInBtn = el("button", "map-zoom-btn", ["+"]);
  const zoomOutBtn = el("button", "map-zoom-btn", ["−"]);
  const zoomResetBtn = el("button", "map-zoom-btn map-zoom-reset", ["1×"]);
  zoomInBtn.type = "button";
  zoomOutBtn.type = "button";
  zoomResetBtn.type = "button";
  zoomInBtn.title = "Zoom in (+)";
  zoomOutBtn.title = "Zoom out (−)";
  zoomResetBtn.title = "Reset zoom";
  zoomControls.append(zoomOutBtn, zoomLabel, zoomInBtn, zoomResetBtn);

  const visibilityNote = el("div", "map-visibility-note", [
    "Fog of war — scout to find the enemy",
  ]);

  viewport.append(cameraLayer, visibilityNote, panHint, zoomControls);
  viewport.classList.add("match-viewport-pan");

  const entityTooltip = mountMatchTooltip(viewport, { getState: () => state });
  applyFactionTheme(ghost, options.humanFaction);
  applyFactionTheme(snapIndicator, options.humanFaction);
  applyFactionTheme(buildRangeLayer, options.humanFaction);

  const syncBuildingMode = () => {
    worldEl.classList.toggle("is-building", selectedBuild !== null && !paused);
  };

  const structureNodes = new Map<string, HTMLElement>();
  const unitNodes = new Map<string, UnitDisplayNode>();
  const projectileNodes = new Map<string, HTMLElement>();
  const completedPulse = new Set<string>();
  let structureRenderKey = "";
  let perfSimMs = 0;
  let perfRenderMs = 0;
  let perfSimSamples = 0;
  let perfRenderSamples = 0;
  let perfSimSum = 0;
  let perfRenderSum = 0;
  const unitPresenter = createUnitInterpolator(() => state.units);
  const matchFog = mountMatchFog(fogHost);
  const commandVfx = mountCommandVfx(worldEl, options.humanFaction);
  const rallyLayer = el("div", "production-rally-vfx");
  worldEl.append(rallyLayer);

  function selectedProductionStructureIds(): string[] {
    const ids: string[] = [];
    if (hqSelected) {
      const hq = getPlayerHq(state, HUMAN_PLAYER_ID);
      if (hq && hq.buildProgress >= 1 && hq.hp > 0) ids.push(hq.instanceId);
    }
    for (const id of selectedBarracksIds) {
      if (isSelectableBarracks(id)) ids.push(id);
    }
    return ids;
  }

  function syncProductionRallyOverlay(): void {
    rallyLayer.replaceChildren();
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "production-rally-lines");
    rallyLayer.append(svg);

    for (const id of selectedProductionStructureIds()) {
      const s = state.structures.find((x) => x.instanceId === id);
      if (!s?.rallyPoint) continue;
      const center = structureCenterPx(s);
      const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
      line.setAttribute("class", "production-rally-line");
      line.setAttribute("x1", String(Math.round(center.x)));
      line.setAttribute("y1", String(Math.round(center.y)));
      line.setAttribute("x2", String(Math.round(s.rallyPoint.x)));
      line.setAttribute("y2", String(Math.round(s.rallyPoint.y)));
      svg.append(line);

      const marker = el("div", "production-rally-marker");
      applyFactionTheme(marker, options.humanFaction);
      marker.style.left = `${s.rallyPoint.x}px`;
      marker.style.top = `${s.rallyPoint.y}px`;
      rallyLayer.append(marker);
    }
  }

  const syncFog = () => {
    matchFog.update(getPlayerVision(state, HUMAN_PLAYER_ID));
    labelAi.classList.toggle("map-zone-label-hidden", !humanHasExploredAiTerritory(state));
    zoneAi.classList.toggle("map-zone-unexplored", !humanHasExploredAiTerritory(state));
  };
  syncFog();
  const barracksDeployTrack = new Map<
    string,
    { activeId: UnitDefId | null; queueLen: number }
  >();
  const structureBuildTrack = new Map<string, number>();
  let panHintHidden = false;
  let minimap: MinimapHandle | null = null;
  let wayfinder: HqWayfinderHandle | null = null;
  let onCameraMoved: (() => void) | null = null;

  const layoutHqWaypoint = () => {
    const hqNow = getPlayerHq(state, HUMAN_PLAYER_ID);
    if (!hqNow) {
      hqWaypointLayer.replaceChildren();
      return;
    }
    const pad = el("div", "hq-waypoint-pad");
    applyFactionTheme(pad, options.humanFaction);
    const tag = el("span", "hq-waypoint-tag", ["YOUR HQ"]);
    pad.append(tag);
    const size = 5 * CELL_PX;
    pad.style.left = `${hqNow.gx * CELL_PX - (size - 2 * CELL_PX) / 2}px`;
    pad.style.top = `${hqNow.gy * CELL_PX - (size - 2 * CELL_PX) / 2}px`;
    pad.style.width = `${size}px`;
    pad.style.height = `${size}px`;
    hqWaypointLayer.replaceChildren(pad);
  };

  const updateMinimap = () => {
    if (!minimap) return;
    const rect = viewport.getBoundingClientRect();
    const structures = state.structures
      .filter(
        (s) =>
          s.ownerId === HUMAN_PLAYER_ID ||
          isStructureVisibleToPlayer(state, HUMAN_PLAYER_ID, s),
      )
      .map((s) => {
      const owner = state.players.get(s.ownerId);
      return {
        gx: s.gx,
        gy: s.gy,
        defId: s.defId,
        ownerId: s.ownerId,
        factionId: (owner?.factionId ?? "triad") as FactionId,
        hp: s.hp,
      };
    });
    const units = state.units
      .filter(
        (u) =>
          u.hp > 0 &&
          (u.ownerId === HUMAN_PLAYER_ID ||
            isUnitVisibleToPlayer(state, HUMAN_PLAYER_ID, u)),
      )
      .map((u) => {
        const owner = state.players.get(u.ownerId);
        return {
          instanceId: u.instanceId,
          x: u.x,
          y: u.y,
          ownerId: u.ownerId,
          factionId: (owner?.factionId ?? "triad") as FactionId,
          defId: u.defId,
          hp: u.hp,
        };
      });
    minimap.update(camera.getCamera(), rect.width, rect.height, structures, units);
  };

  const camera = attachMapCamera(viewport, cameraLayer, {
    enabled: () => options.panEnabled() && !paused,
    allowDragPan: () =>
      options.panEnabled() && !paused && (selectedBuild !== null || spaceHeld),
    onZoomLabel: (pct) => {
      zoomLabel.textContent = `${pct}%`;
    },
    onCameraChange: () => {
      updateMinimap();
      wayfinder?.update();
      onCameraMoved?.();
      if (!panHintHidden) {
        panHintHidden = true;
        panHint.classList.add("fade-out");
        options.onPanHint?.(false);
      }
    },
  });

  zoomInBtn.onclick = (e) => {
    e.stopPropagation();
    camera.zoomIn();
  };
  zoomOutBtn.onclick = (e) => {
    e.stopPropagation();
    camera.zoomOut();
  };
  zoomResetBtn.onclick = (e) => {
    e.stopPropagation();
    camera.resetZoom();
  };

  if (options.minimapHost) {
    minimap = mountMinimap(options.minimapHost, {
      getCamera: () => camera.getCamera(),
      onNavigate: (cam) => camera.setCamera(cam),
      onFocusHq: () => {
        const hqNow = getPlayerHq(state, HUMAN_PLAYER_ID);
        if (hqNow) focusCameraWhenReady(viewport, camera, hqNow.gx, hqNow.gy);
      },
      onFocusEnemy: () => {
        const aiHq = getPlayerHq(state, AI_PLAYER_ID);
        if (aiHq && isStructureVisibleToPlayer(state, HUMAN_PLAYER_ID, aiHq)) {
          focusCameraWhenReady(viewport, camera, aiHq.gx, aiHq.gy);
          return;
        }
        const scout = state.units.find(
          (u) =>
            u.ownerId === HUMAN_PLAYER_ID &&
            u.hp > 0 &&
            isCombatUnit(u.defId) &&
            u.order.type === "move",
        );
        if (scout) {
          focusCameraWhenReady(
            viewport,
            camera,
            Math.floor(scout.x / CELL_PX),
            Math.floor(scout.y / CELL_PX),
          );
        }
      },
      getHumanVision: () => getPlayerVision(state, HUMAN_PLAYER_ID),
    });
  }

  wayfinder = attachHqWayfinder(viewport, {
    getHqCell: () => {
      const h = getPlayerHq(state, HUMAN_PLAYER_ID);
      return h ? { gx: h.gx, gy: h.gy } : null;
    },
    getCamera: () => camera.getCamera(),
    onGoHome: () => focusCameraWhenReady(viewport, camera, HUMAN_HQ_SPAWN.gx, HUMAN_HQ_SPAWN.gy),
  });

  layoutHqWaypoint();
  const hq = getPlayerHq(state, HUMAN_PLAYER_ID);
  if (hq) {
    focusCameraWhenReady(viewport, camera, hq.gx, hq.gy);
  }
  wayfinder.update();

  function buildUnitPanelSnapshot(): UnitPanelSnapshot | null {
    if (selectedUnitIds.size === 0) return null;
    const live: Unit[] = [];
    for (const id of selectedUnitIds) {
      const u = state.units.find((x) => x.instanceId === id);
      if (u && u.ownerId === HUMAN_PLAYER_ID && u.hp > 0) live.push(u);
      else selectedUnitIds.delete(id);
    }
    if (live.length === 0) {
      syncUnitDom();
      return null;
    }

    const factionId = options.humanFaction;
    const entries: UnitPanelEntry[] = live.map((u) => {
      const def = unitDef(u.defId);
      const tip = unitTooltipContent(state, u);
      return {
        defId: u.defId,
        displayName: def.displayName,
        roleLabel: UNIT_VISUAL[u.defId].roleLabel,
        hp: u.hp,
        maxHp: def.maxHp,
        status: tip.status,
        detail: tip.detail,
      };
    });

    const totalHp = entries.reduce((s, e) => s + e.hp, 0);
    const totalMaxHp = entries.reduce((s, e) => s + e.maxHp, 0);
    const primary = entries[0]!;

    let status = primary.status;
    let detail = primary.detail;
    if (live.length > 1) {
      const statuses = new Set(entries.map((e) => e.status).filter(Boolean));
      status = statuses.size === 1 ? [...statuses][0]! : "Mixed activity";
      const details = entries.map((e) => e.detail).filter(Boolean);
      detail = details.length === 1 ? details[0]! : "";
    }

    return {
      count: live.length,
      factionId,
      status,
      detail,
      totalHp,
      totalMaxHp,
      primaryDefId: primary.defId,
      primaryName: primary.displayName,
      primaryRole: primary.roleLabel,
      entries,
    };
  }

  function syncUnitPanelSnapshot(): void {
    options.onUnitSelectionChange?.(buildUnitPanelSnapshot());
  }

  const syncSelectionHint = () => {
    syncUnitPanelSnapshot();
    for (const id of selectedBarracksIds) {
      if (!isSelectableBarracks(id)) selectedBarracksIds.delete(id);
    }
    const barracksIds = [...selectedBarracksIds];
    options.onBarracksSelected?.(barracksIds);
    options.onHqSelected?.(hqSelected);
    syncProductionRallyOverlay();
    if (selectedUnitIds.size > 0) return;
    if (hqSelected && barracksIds.length === 0) {
      options.onSelectionHint?.(
        "HQ selected — train Workers, build structures, right-click map to set rally point",
      );
      return;
    }
    if (barracksIds.length > 0) {
      const label =
        barracksIds.length === 1
          ? "1 Barracks selected"
          : `${barracksIds.length} Barracks selected`;
      options.onSelectionHint?.(
        `${label} — train troops below · right-click map to set rally point`,
      );
      return;
    }
    options.onSelectionHint?.(
      "Drag to select troops · Shift+click Barracks for multi-select",
    );
  };

  const tickTimer = window.setInterval(() => {
    if (paused || !options.simEnabled() || skirmishEnded) return;

    unitPresenter.captureBeforeTick();
    const combatPrev = captureCombatSnapshot();
    const simStart = performance.now();
    state = advanceSkirmishTick(state);
    perfSimMs = performance.now() - simStart;
    perfSimSum += perfSimMs;
    perfSimSamples += 1;

    const human = state.players.get(HUMAN_PLAYER_ID);
    if (human) options.onMatterChange(human.matter);
    options.onUnitCountChange?.(
      countPlayerUnits(state, HUMAN_PLAYER_ID),
      PLAYER_UNIT_CAP,
    );

    const renderStart = performance.now();
    renderStructuresIfNeeded();
    syncUnitDom();
    syncStructureActivityVfx();
    syncProjectileDom();
    detectBarracksDeploys();
    detectStructureBuildComplete();
    detectCombatAudio(combatPrev);
    syncFog();
    updateMinimap();
    perfRenderMs = performance.now() - renderStart;
    perfRenderSum += perfRenderMs;
    perfRenderSamples += 1;
    entityTooltip.refresh();
    if (selectedUnitIds.size > 0) syncUnitPanelSnapshot();

    const outcome = checkSkirmishOutcome(state);
    if (outcome !== "ongoing") {
      skirmishEnded = true;
      unitPresenter.stop();
      options.onSkirmishEnd?.(outcome);
    }
  }, BUILD_TICK_MS);

  unitPresenter.start(unitNodes);

  function factionColor(ownerId: string): string {
    const p = state.players.get(ownerId);
    if (!p) return "var(--muted)";
    return factionById(p.factionId as FactionId).color;
  }

  function footprintPx(defId: StructureDefId): { w: number; h: number } {
    const fp = structureDef(defId).footprint;
    return { w: fp.w * CELL_PX, h: fp.h * CELL_PX };
  }

  function renderStructures(): void {
    const seen = new Set<string>();
    for (const s of state.structures) {
      if (
        s.ownerId !== HUMAN_PLAYER_ID &&
        !isStructureVisibleToPlayer(state, HUMAN_PLAYER_ID, s)
      ) {
        continue;
      }
      seen.add(s.instanceId);
      let node = structureNodes.get(s.instanceId);
      const def = structureDef(s.defId);
      const { w, h } = footprintPx(s.defId);
      const pct = Math.round(s.buildProgress * 100);
      const building = s.buildProgress < 1;

      const owner = state.players.get(s.ownerId);
      const ownerFaction = (owner?.factionId ?? "triad") as FactionId;

      if (!node) {
        node = el("div", `field-structure structure-${s.defId}`);
        node.dataset.instanceId = s.instanceId;
        const glyph = el("div", "structure-glyph");
        if (s.defId === "hq" && s.ownerId === HUMAN_PLAYER_ID) {
          const beacon = el("div", "hq-beacon");
          node.append(beacon);
        }
        const scaffold = el("div", "structure-scaffold");
        const label = el("span", "structure-label", [
          s.defId === "hq" && s.ownerId === HUMAN_PLAYER_ID ? "YOUR HQ" : def.displayName,
        ]);
        const status = el("span", "structure-status", [""]);
        const hpTrack = el("div", "structure-hp-track");
        const hpFill = el("div", "structure-hp-fill");
        hpTrack.append(hpFill);
        const bar = el("div", "structure-progress-track");
        const fill = el("div", "structure-progress-fill");
        bar.append(fill);
        node.append(glyph, scaffold, label, status, hpTrack, bar);
        structuresLayer.append(node);
        structureNodes.set(s.instanceId, node);
      }

      applyFactionTheme(node, ownerFaction);

      const labelEl = node.querySelector(".structure-label") as HTMLElement;
      const shape = factionById(ownerFaction).shapeSymbol;
      const displayName = structureDisplayNameForFaction(s.defId, ownerFaction);
      labelEl.textContent =
        s.defId === "hq" && s.ownerId === HUMAN_PLAYER_ID
          ? `${shape} YOUR HQ`
          : `${shape} ${displayName}`;

      node.style.left = `${s.gx * CELL_PX}px`;
      node.style.top = `${s.gy * CELL_PX}px`;
      node.style.width = `${w}px`;
      node.style.height = `${h}px`;
      node.style.setProperty("--faction-color", factionColor(s.ownerId));
      node.classList.toggle("structure-building", building);
      node.classList.toggle("structure-built", !building);
      node.classList.toggle("structure-human", s.ownerId === HUMAN_PLAYER_ID);
      const turretCd = def.turretCooldownTicks ?? 0;
      node.classList.toggle(
        "structure-turret-firing",
        s.defId === "turret" &&
          !building &&
          (s.attackCooldown ?? 0) >= turretCd - 1 &&
          turretCd > 0,
      );

      const status = node.querySelector(".structure-status") as HTMLElement;
      const fill = node.querySelector(".structure-progress-fill") as HTMLElement;
      const hpFill = node.querySelector(".structure-hp-fill") as HTMLElement;
      const hpPct = s.maxHp > 0 ? Math.round((s.hp / s.maxHp) * 100) : 0;
      hpFill.style.width = `${hpPct}%`;
      const hpTrack = node.querySelector(".structure-hp-track") as HTMLElement;
      hpTrack.style.display = building || s.hp <= 0 ? "none" : "block";

      if (
        s.defId === "barracks" &&
        s.ownerId === HUMAN_PLAYER_ID &&
        selectedBarracksIds.has(s.instanceId)
      ) {
        let ring = node.querySelector(".barracks-selected-ring") as HTMLElement | null;
        if (!ring) {
          ring = el("div", "barracks-selected-ring");
          node.append(ring);
        }
      } else {
        node.querySelector(".barracks-selected-ring")?.remove();
      }

      if (
        s.defId === "hq" &&
        s.ownerId === HUMAN_PLAYER_ID &&
        hqSelected
      ) {
        let ring = node.querySelector(".hq-selected-ring") as HTMLElement | null;
        if (!ring) {
          ring = el("div", "hq-selected-ring");
          node.append(ring);
        }
      } else {
        node.querySelector(".hq-selected-ring")?.remove();
      }

      syncBarracksTrainOverlay(node, s, ownerFaction);
      syncHqTrainOverlay(node, s, ownerFaction);

      if (building) {
        const crew = workersAtStructure(state, s.instanceId);
        status.textContent =
          crew > 0
            ? `Constructing ${pct}% · ${crew} worker${crew === 1 ? "" : "s"}`
            : `Constructing ${pct}% · need workers`;
        fill.style.width = `${pct}%`;
      } else if (s.defId === "turret" && s.buildProgress >= 1 && s.hp > 0) {
        status.textContent = s.hp < s.maxHp ? `HP ${Math.ceil(s.hp)}` : "Auto-defense";
        fill.style.width = "100%";
      } else if (s.defId === "generator" && s.buildProgress >= 1 && s.hp > 0) {
        const operating = workersOperatingGenerator(state, s.instanceId);
        const assigned = workersAssignedToGenerator(state, s.instanceId);
        const rate = structureDef("generator").incomePerTick ?? 0;
        if (operating > 0) {
          status.textContent = `Mining ◆${operating * rate}/tick · ${operating}/${MAX_GENERATOR_WORKERS} workers`;
        } else if (assigned > 0) {
          status.textContent = `${assigned} worker${assigned === 1 ? "" : "s"} en route · max ${MAX_GENERATOR_WORKERS}`;
        } else if (s.ownerId === HUMAN_PLAYER_ID) {
          status.textContent = `Idle · assign workers (right-click)`;
        } else {
          status.textContent = "";
        }
        fill.style.width = "100%";
      } else {
        status.textContent = s.hp < s.maxHp ? `HP ${Math.ceil(s.hp)}` : "";
        fill.style.width = "100%";
        if (!completedPulse.has(s.instanceId)) {
          completedPulse.add(s.instanceId);
          node.classList.add("structure-just-built");
          window.setTimeout(() => node.classList.remove("structure-just-built"), 600);
        }
      }
    }

    for (const [id, node] of structureNodes) {
      if (!seen.has(id)) {
        node.remove();
        structureNodes.delete(id);
        completedPulse.delete(id);
      }
    }
  }

  function syncBarracksTrainOverlay(
    node: HTMLElement,
    s: (typeof state.structures)[0],
    ownerFaction: FactionId,
  ): void {
    if (s.defId !== "barracks" || s.trainQueue.length === 0 || s.buildProgress < 1) {
      node.querySelector(".barracks-train-overlay")?.remove();
      return;
    }

    const head = s.trainQueue[0]!;
    const pct = Math.round(head.progress * 100);
    const udef = unitDef(head.unitDefId);
    const isMelee = head.unitDefId === "striker";
    const queued = s.trainQueue.length - 1;

    let overlay = node.querySelector(".barracks-train-overlay") as HTMLElement | null;
    if (!overlay) {
      overlay = el("div", "barracks-train-overlay");
      const glyph = el("div", `barracks-train-glyph ${isMelee ? "train-melee" : "train-ranged"}`);
      const label = el("span", "barracks-train-label", [""]);
      const queueLabel = el("span", "barracks-train-queue", [""]);
      const track = el("div", "barracks-train-track");
      const fill = el("div", "barracks-train-fill");
      track.append(fill);
      overlay.append(glyph, label, queueLabel, track);
      node.append(overlay);
      applyFactionTheme(overlay, ownerFaction);
    }

    const glyph = overlay.querySelector(".barracks-train-glyph") as HTMLElement;
    glyph.classList.toggle("train-melee", isMelee);
    glyph.classList.toggle("train-ranged", !isMelee);
    const label = overlay.querySelector(".barracks-train-label") as HTMLElement;
    label.textContent = `Training ${udef.displayName} ${pct}%`;
    const queueLabel = overlay.querySelector(".barracks-train-queue") as HTMLElement;
    queueLabel.textContent = queued > 0 ? `+${queued} queued` : "";
    const fill = overlay.querySelector(".barracks-train-fill") as HTMLElement;
    fill.style.width = `${pct}%`;
  }

  function syncBuildWorkVfx(
    node: HTMLElement,
    s: (typeof state.structures)[0],
    ownerFaction: FactionId,
  ): void {
    const crew = s.buildProgress < 1 ? workersAtStructure(state, s.instanceId) : 0;
    const active = crew > 0;

    if (!active) {
      node.classList.remove("structure-build-active");
      node.querySelector(".build-work-fx")?.remove();
      return;
    }

    node.classList.add("structure-build-active");

    let fx = node.querySelector(".build-work-fx") as HTMLElement | null;
    if (!fx) {
      fx = el("div", "build-work-fx");
      for (let i = 0; i < 3; i++) {
        fx.append(el("span", "build-work-spark"));
      }
      fx.append(el("div", "build-work-glow"));
      node.append(fx);
      applyFactionTheme(fx, ownerFaction);
    }
    fx.dataset.crew = String(crew);
  }

  function syncGeneratorWorkVfx(
    node: HTMLElement,
    s: (typeof state.structures)[0],
    ownerFaction: FactionId,
  ): void {
    const active = s.defId === "generator" && s.buildProgress >= 1 && s.hp > 0;
    const operating = active ? workersOperatingGenerator(state, s.instanceId) : 0;

    if (!active || operating <= 0) {
      node.classList.remove("structure-generator-active");
      node.querySelector(".generator-work-fx")?.remove();
      return;
    }

    node.classList.add("structure-generator-active");

    let fx = node.querySelector(".generator-work-fx") as HTMLElement | null;
    if (!fx) {
      fx = el("div", "generator-work-fx");
      for (let i = 0; i < 3; i++) {
        fx.append(el("span", "generator-work-spark"));
      }
      const glow = el("div", "generator-work-glow");
      fx.append(glow);
      node.append(fx);
      applyFactionTheme(fx, ownerFaction);
    }
    fx.dataset.crew = String(operating);
  }

  function syncWorkerBuildVfx(
    root: HTMLElement,
    active: boolean,
    ownerFaction: FactionId,
  ): void {
    if (!active) {
      root.querySelector(".worker-build-fx")?.remove();
      return;
    }

    let fx = root.querySelector(".worker-build-fx") as HTMLElement | null;
    if (!fx) {
      fx = el("div", "worker-build-fx");
      for (let i = 0; i < 2; i++) {
        fx.append(el("span", "worker-build-spark"));
      }
      root.append(fx);
      applyFactionTheme(fx, ownerFaction);
    }
  }

  function syncStructureActivityVfx(): void {
    for (const s of state.structures) {
      if (
        s.ownerId !== HUMAN_PLAYER_ID &&
        !isStructureVisibleToPlayer(state, HUMAN_PLAYER_ID, s)
      ) {
        continue;
      }
      const node = structureNodes.get(s.instanceId);
      if (!node) continue;
      const owner = state.players.get(s.ownerId);
      const ownerFaction = (owner?.factionId ?? "triad") as FactionId;
      syncBuildWorkVfx(node, s, ownerFaction);
      syncGeneratorWorkVfx(node, s, ownerFaction);
    }
  }

  function syncHqTrainOverlay(
    node: HTMLElement,
    s: (typeof state.structures)[0],
    ownerFaction: FactionId,
  ): void {
    if (s.defId !== "hq" || s.trainQueue.length === 0 || s.buildProgress < 1) {
      node.querySelector(".hq-train-overlay")?.remove();
      return;
    }

    const head = s.trainQueue[0]!;
    const pct = Math.round(head.progress * 100);
    const udef = unitDef(head.unitDefId);
    const queued = s.trainQueue.length - 1;

    let overlay = node.querySelector(".hq-train-overlay") as HTMLElement | null;
    if (!overlay) {
      overlay = el("div", "barracks-train-overlay hq-train-overlay");
      const glyph = el("div", "barracks-train-glyph train-worker");
      const label = el("span", "barracks-train-label", [""]);
      const queueLabel = el("span", "barracks-train-queue", [""]);
      const track = el("div", "barracks-train-track");
      const fill = el("div", "barracks-train-fill");
      track.append(fill);
      overlay.append(glyph, label, queueLabel, track);
      node.append(overlay);
      applyFactionTheme(overlay, ownerFaction);
    }

    const label = overlay.querySelector(".barracks-train-label") as HTMLElement;
    label.textContent = `Training ${udef.displayName} ${pct}%`;
    const queueLabel = overlay.querySelector(".barracks-train-queue") as HTMLElement;
    queueLabel.textContent = queued > 0 ? `+${queued} queued` : "";
    const fill = overlay.querySelector(".barracks-train-fill") as HTMLElement;
    fill.style.width = `${pct}%`;
  }

  function detectBarracksDeploys(): void {
    for (const s of state.structures) {
      if (s.defId !== "barracks") continue;
      const first = s.trainQueue[0];
      const activeId = first?.unitDefId ?? null;
      const queueLen = s.trainQueue.length;
      const prev = barracksDeployTrack.get(s.instanceId);

      if (
        prev?.activeId &&
        s.buildProgress >= 1 &&
        s.hp > 0 &&
        (activeId !== prev.activeId || queueLen < prev.queueLen)
      ) {
        const pt = barracksSpawnPoint(s);
        commandVfx.showDeploy(pt.x, pt.y, prev.activeId);
        if (s.ownerId === HUMAN_PLAYER_ID) {
          audio.play("unit.deploy");
        }
      }

      barracksDeployTrack.set(s.instanceId, { activeId, queueLen });
    }
  }

  function detectStructureBuildComplete(): void {
    for (const s of state.structures) {
      const prev = structureBuildTrack.get(s.instanceId);
      const cur = s.buildProgress;
      if (
        prev !== undefined &&
        prev < 1 &&
        cur >= 1 &&
        s.ownerId === HUMAN_PLAYER_ID &&
        s.hp > 0
      ) {
        audio.play("build.complete");
      }
      structureBuildTrack.set(s.instanceId, cur);
    }
  }

  type CombatSnapshot = {
    projectiles: Map<string, { x: number; y: number; ownerId: string }>;
    units: Map<
      string,
      { hp: number; meleeSwingTicks: number; x: number; y: number; ownerId: string }
    >;
  };

  function captureCombatSnapshot(): CombatSnapshot {
    const projectiles = new Map<string, { x: number; y: number; ownerId: string }>();
    for (const p of state.projectiles) {
      projectiles.set(p.id, { x: p.x, y: p.y, ownerId: p.ownerId });
    }
    const units = new Map<
      string,
      { hp: number; meleeSwingTicks: number; x: number; y: number; ownerId: string }
    >();
    for (const u of state.units) {
      if (u.hp <= 0) continue;
      units.set(u.instanceId, {
        hp: u.hp,
        meleeSwingTicks: u.meleeSwingTicks,
        x: u.x,
        y: u.y,
        ownerId: u.ownerId,
      });
    }
    return { projectiles, units };
  }

  function isCombatAudibleAt(x: number, y: number, ownerId: string): boolean {
    if (ownerId === HUMAN_PLAYER_ID) return true;
    const vision = getPlayerVision(state, HUMAN_PLAYER_ID);
    if (!vision) return true;
    const cell = worldToNavCell(x, y);
    return isCellVisible(vision, cell.gx, cell.gy);
  }

  function detectCombatAudio(prev: CombatSnapshot): void {
    const curProjectiles = new Map(state.projectiles.map((p) => [p.id, p]));

    for (const p of state.projectiles) {
      if (!prev.projectiles.has(p.id) && isCombatAudibleAt(p.x, p.y, p.ownerId)) {
        audio.play("combat.attack.ranged");
      }
    }

    for (const [id, p] of prev.projectiles) {
      if (!curProjectiles.has(id) && isCombatAudibleAt(p.x, p.y, p.ownerId)) {
        audio.play("combat.hit");
      }
    }

    const curUnits = new Map<string, (typeof state.units)[0]>();
    for (const u of state.units) {
      if (u.hp > 0) curUnits.set(u.instanceId, u);
    }

    for (const [id, prevU] of prev.units) {
      const cur = curUnits.get(id);
      if (!cur) {
        if (isCombatAudibleAt(prevU.x, prevU.y, prevU.ownerId)) {
          audio.play("unit.destroyed");
        }
        continue;
      }
      if (prevU.meleeSwingTicks === 0 && cur.meleeSwingTicks > 0) {
        if (isCombatAudibleAt(cur.x, cur.y, cur.ownerId)) {
          audio.play("combat.attack.melee");
        }
      }
    }
  }

  function commandTargetCenter(
    targetId: string,
    targetKind: TargetKind,
  ): { x: number; y: number } | null {
    if (targetKind === "unit") {
      const u = state.units.find((x) => x.instanceId === targetId && x.hp > 0);
      return u ? { x: u.x, y: u.y } : null;
    }
    const s = state.structures.find((x) => x.instanceId === targetId);
    return s && s.hp > 0 ? structureCenterPx(s) : null;
  }

  function structureSignature(): string {
    return state.structures
      .map((s) => {
        const q = s.trainQueue.map((e) => `${e.unitDefId}:${e.progress}`).join(",");
        const rally = s.rallyPoint ? `${s.rallyPoint.x},${s.rallyPoint.y}` : "";
        return `${s.instanceId}:${s.buildProgress}:${s.hp}:${q}:${rally}`;
      })
      .join(";");
  }

  function syncMatterDeposits(): void {
    const vision = getPlayerVision(state, HUMAN_PLAYER_ID);
    for (const d of SKIRMISH_MATTER_DEPOSITS) {
      const node = matterDepositNodes.get(d.id);
      if (!node) continue;
      const cellExplored = !vision || isCellExplored(vision, d.gx, d.gy);
      node.classList.toggle("map-matter-deposit--hidden", !cellExplored);
      const claimed = isMatterDepositConsumed(state, d.id);
      node.classList.toggle("map-matter-deposit--claimed", claimed);
      node.title = claimed
        ? "Matter deposit — generator built"
        : "Matter deposit — build generator here";
    }
  }

  function renderStructuresIfNeeded(): void {
    syncMatterDeposits();
    const key = structureSignature();
    if (key === structureRenderKey) return;
    structureRenderKey = key;
    renderStructures();
    syncProductionRallyOverlay();
  }

  function syncUnitDom(): void {
    const seen = new Set<string>();
    for (const u of state.units) {
      if (u.hp <= 0) continue;
      if (
        u.ownerId !== HUMAN_PLAYER_ID &&
        !isUnitVisibleToPlayer(state, HUMAN_PLAYER_ID, u)
      ) {
        continue;
      }
      seen.add(u.instanceId);
      let entry = unitNodes.get(u.instanceId);
      const owner = state.players.get(u.ownerId);
      const ownerFaction = (owner?.factionId ?? "triad") as FactionId;
      const def = unitDef(u.defId);

      if (!entry) {
        const root = el("div", "field-unit");
        root.dataset.unitId = u.instanceId;
        root.style.willChange = "transform";
        applyUnitVisualClasses(root, u.defId);
        const glyph = el("div", `field-unit-glyph field-unit-glyph--${u.defId}`);
        const core = el("div", "field-unit-core");
        const hpTrack = el("div", "unit-hp-track");
        const hpFill = el("div", "unit-hp-fill");
        glyph.append(core);
        hpTrack.append(hpFill);
        root.append(glyph, hpTrack);
        unitsLayer.append(root);
        entry = { root, hpFill };
        unitNodes.set(u.instanceId, entry);
        applyFactionTheme(root, ownerFaction);
      }

      const { root, hpFill } = entry;
      root.classList.toggle("field-unit-selected", selectedUnitIds.has(u.instanceId));
      root.classList.toggle("field-unit-enemy", u.ownerId !== HUMAN_PLAYER_ID);
      root.classList.toggle(
        "field-unit-gathering",
        u.defId === "worker" && u.order.type === "gather",
      );
      const building =
        u.defId === "worker" && workerActivelyBuilding(state, u);
      root.classList.toggle("field-unit-constructing", building);
      if (u.defId === "worker") {
        syncWorkerBuildVfx(root, building, ownerFaction);
      }
      hpFill.style.width = `${Math.round((u.hp / def.maxHp) * 100)}%`;

      if (u.meleeSwingTicks > 0 && !root.querySelector(".melee-swing")) {
        const swing = el("div", "melee-swing");
        root.append(swing);
        window.setTimeout(() => swing.remove(), 400);
      }
    }

    for (const [id, entry] of unitNodes) {
      if (!seen.has(id)) {
        entry.root.remove();
        unitNodes.delete(id);
      }
    }
  }

  function syncProjectileDom(): void {
    const seen = new Set<string>();
    const vision = getPlayerVision(state, HUMAN_PLAYER_ID);
    for (const p of state.projectiles) {
      if (p.ownerId !== HUMAN_PLAYER_ID && vision) {
        const cell = worldToNavCell(p.x, p.y);
        if (!isCellVisible(vision, cell.gx, cell.gy)) continue;
      }
      seen.add(p.id);
      let node = projectileNodes.get(p.id);
      if (!node) {
        node = el("div", "field-projectile");
        node.style.willChange = "transform";
        effectsLayer.append(node);
        projectileNodes.set(p.id, node);
      }
      node.style.transform = `translate3d(${p.x - 5}px, ${p.y - 5}px, 0)`;
    }
    for (const [id, node] of projectileNodes) {
      if (!seen.has(id)) {
        node.remove();
        projectileNodes.delete(id);
      }
    }
  }

  function renderHighlight(): void {
    buildRangeLayer.replaceChildren();
    if (!selectedBuild) return;
    const cells = buildRangeCells(state, HUMAN_PLAYER_ID, selectedBuild);
    for (const key of cells) {
      const [gx, gy] = key.split(",").map(Number);
      const cell = el("div", P.rangeCell);
      cell.style.left = `${gx * CELL_PX}px`;
      cell.style.top = `${gy * CELL_PX}px`;
      cell.style.width = `${CELL_PX}px`;
      cell.style.height = `${CELL_PX}px`;
      buildRangeLayer.append(cell);
    }
  }

  function canPreviewBlueprint(): boolean {
    return selectedBuild !== null && !paused;
  }

  function canPlaceOnMap(): boolean {
    return selectedBuild !== null && !paused && options.canPlace();
  }

  registerMatchCameraFocus((gx, gy) => {
    focusCameraWhenReady(viewport, camera, gx, gy);
  });

  registerMatchDebug(() => {
    const rect = viewport.getBoundingClientRect();
    const hqNow = getPlayerHq(state, HUMAN_PLAYER_ID);
    const human = state.players.get(HUMAN_PLAYER_ID);
    const avgSim = perfSimSamples > 0 ? perfSimSum / perfSimSamples : 0;
    const avgRender = perfRenderSamples > 0 ? perfRenderSum / perfRenderSamples : 0;
    return {
      at: new Date().toISOString(),
      selectedBuild,
      paused,
      introEnabled: options.canPlace(),
      camera: camera.getCamera(),
      viewport: { width: rect.width, height: rect.height },
      snapCell: snapGx >= 0 ? { gx: snapGx, gy: snapGy } : null,
      hq: hqNow ? { gx: hqNow.gx, gy: hqNow.gy } : null,
      structureCount: state.structures.length,
      unitCount: state.units.filter((u) => u.hp > 0).length,
      projectileCount: state.projectiles.length,
      matter: human?.matter ?? 0,
      simTick: state.tick,
      perf: {
        lastSimMs: Math.round(perfSimMs * 100) / 100,
        lastRenderMs: Math.round(perfRenderMs * 100) / 100,
        avgSimMs: Math.round(avgSim * 100) / 100,
        avgRenderMs: Math.round(avgRender * 100) / 100,
        simFps: avgSim > 0 ? Math.round(1000 / avgSim) : 0,
      },
      structures: state.structures.map((s) => ({
        defId: s.defId,
        ownerId: s.ownerId,
        gx: s.gx,
        gy: s.gy,
        progress: s.buildProgress,
      })),
    };
  });

  function setBuildPreviewAtCell(gx: number, gy: number, w: number, h: number): void {
    const left = `${gx * CELL_PX}px`;
    const top = `${gy * CELL_PX}px`;
    const width = `${w}px`;
    const height = `${h}px`;
    snapIndicator.style.left = left;
    snapIndicator.style.top = top;
    snapIndicator.style.width = width;
    snapIndicator.style.height = height;
    ghost.style.left = left;
    ghost.style.top = top;
    ghost.style.width = width;
    ghost.style.height = height;
  }

  function syncBlueprintFromPointer(clientX: number, clientY: number): void {
    if (!selectedBuild) return;
    const rect = viewport.getBoundingClientRect();
    const inView =
      clientX >= rect.left &&
      clientX <= rect.right &&
      clientY >= rect.top &&
      clientY <= rect.bottom;

    const def = structureDef(selectedBuild);
    const { w, h } = footprintPx(selectedBuild);

    if (inView) {
      const { worldX, worldY } = clientToWorld(clientX, clientY, rect, camera.getCamera(), worldEl);
      const anchor = placementCellFromWorld(worldX, worldY, def.footprint);
      snapGx = anchor.gx;
      snapGy = anchor.gy;

      setBuildPreviewAtCell(snapGx, snapGy, w, h);
      snapIndicator.classList.remove(P.hidden);
      ghost.classList.remove(P.hidden);

      const check = canPlaceStructure(state, HUMAN_PLAYER_ID, selectedBuild, snapGx, snapGy);
      ghost.classList.toggle(P.valid, check.ok);
      ghost.classList.toggle(P.invalid, !check.ok);
      snapIndicator.classList.toggle(P.valid, check.ok);
      snapIndicator.classList.toggle(P.invalid, !check.ok);
      ghostLabel.textContent = def.displayName;
      ghostHint.textContent = check.ok ? "Click to place" : placementShortHint(check.reason);
    } else {
      ghost.classList.add(P.hidden);
      snapIndicator.classList.add(P.hidden);
    }
  }

  onCameraMoved = () => {
    if (hasPointer && canPreviewBlueprint()) {
      syncBlueprintFromPointer(lastClientX, lastClientY);
    }
  };

  function onGlobalPointerMove(e: PointerEvent): void {
    lastClientX = e.clientX;
    lastClientY = e.clientY;
    hasPointer = true;
    if (!canPreviewBlueprint()) return;
    syncBlueprintFromPointer(e.clientX, e.clientY);
  }

  function showBlueprint(): void {
    viewport.classList.add("is-placing");
    syncBuildingMode();
    if (selectedBuild) {
      const { w, h } = footprintPx(selectedBuild);
      ghost.style.width = `${w}px`;
      ghost.style.height = `${h}px`;
      if (hasPointer) {
        syncBlueprintFromPointer(lastClientX, lastClientY);
      } else {
        const rect = viewport.getBoundingClientRect();
        syncBlueprintFromPointer(rect.left + rect.width / 2, rect.top + rect.height / 2);
      }
    }
  }

  function hideBlueprint(): void {
    ghost.classList.add(P.hidden);
    snapIndicator.classList.add(P.hidden);
    viewport.classList.remove("is-placing");
    syncBuildingMode();
  }

  function spawnPlacementFlash(gx: number, gy: number, defId: StructureDefId): void {
    const { w, h } = footprintPx(defId);
    const flash = el("div", "placement-flash");
    applyFactionTheme(flash, options.humanFaction);
    flash.style.left = `${gx * CELL_PX}px`;
    flash.style.top = `${gy * CELL_PX}px`;
    flash.style.width = `${w}px`;
    flash.style.height = `${h}px`;
    effectsLayer.append(flash);
    window.setTimeout(() => flash.remove(), 700);
  }

  function placementShortHint(reason: string | undefined): string {
    switch (reason) {
      case "outside_territory":
        return "Your territory only";
      case "out_of_range":
        return "Too far from HQ";
      case "overlap":
        return "Blocked";
      case "blocked_terrain":
        return "Rock wall";
      case "insufficient_matter":
        return "Need more ◆";
      case "no_matter_deposit":
        return "Need matter node";
      case "matter_deposit_claimed":
        return "Node used";
      default:
        return "Cannot place";
    }
  }

  function placementHint(reason: string | undefined): void {
    switch (reason) {
      case "outside_territory":
        options.onBuildHint("Blueprint: build only in your territory (west)");
        break;
      case "out_of_range":
        options.onBuildHint("Blueprint: too far from your HQ");
        break;
      case "overlap":
        options.onBuildHint("Blueprint: overlaps another structure");
        break;
      case "blocked_terrain":
        options.onBuildHint("Blueprint: cannot build on rock barriers");
        break;
      case "insufficient_matter":
        options.onBuildHint("Blueprint: not enough matter ◆");
        break;
      case "no_matter_deposit":
        options.onBuildHint("Blueprint: generators only on ◆ matter deposits (diamond markers)");
        break;
      case "matter_deposit_claimed":
        options.onBuildHint("Blueprint: this matter deposit already has a generator");
        break;
      default:
        options.onBuildHint(
          selectedBuild
            ? "Blueprint follows cursor — click to place · drag/WASD pan · wheel zoom"
            : "Select a structure to build",
        );
    }
  }

  function clearUnitSelection(): void {
    selectedUnitIds.clear();
    syncUnitDom();
    syncSelectionHint();
  }

  function stopSelectedUnits(): void {
    if (selectedUnitIds.size === 0) return;
    state = {
      ...state,
      units: issueStopOrder(state.units, selectedUnitIds),
    };
    syncUnitDom();
    syncUnitPanelSnapshot();
  }

  function clearBarracksSelection(): void {
    if (selectedBarracksIds.size === 0) return;
    selectedBarracksIds.clear();
    renderStructuresIfNeeded();
    syncSelectionHint();
  }

  function clearHqSelection(): void {
    if (!hqSelected) return;
    hqSelected = false;
    renderStructuresIfNeeded();
    syncSelectionHint();
  }

  function selectHq(selected: boolean, playFeedback = true): void {
    const wasSelected = hqSelected;
    hqSelected = selected;
    if (hqSelected && !wasSelected && playFeedback) {
      audio.play("select.structure");
    }
    if (hqSelected) {
      clearBarracksSelection();
      clearUnitSelection();
      if (selectedBuild) {
        selectedBuild = null;
        hideBlueprint();
        syncBuildingMode();
        renderHighlight();
      }
    }
    renderStructuresIfNeeded();
    syncSelectionHint();
  }

  function isSelectableBarracks(instanceId: string): boolean {
    const s = state.structures.find((x) => x.instanceId === instanceId);
    return (
      !!s &&
      s.ownerId === HUMAN_PLAYER_ID &&
      s.defId === "barracks" &&
      s.buildProgress >= 1 &&
      s.hp > 0
    );
  }

  function selectBarracks(
    ids: string[],
    additive: boolean,
    /** Shift+click toggles; shift+drag box only adds. */
    toggleWhenAdditive = additive,
  ): void {
    if (!additive) selectedBarracksIds.clear();
    let newlySelected = false;
    for (const id of ids) {
      if (!isSelectableBarracks(id)) continue;
      if (toggleWhenAdditive && additive && selectedBarracksIds.has(id)) {
        selectedBarracksIds.delete(id);
      } else {
        if (!selectedBarracksIds.has(id)) newlySelected = true;
        selectedBarracksIds.add(id);
      }
    }
    if (newlySelected) {
      audio.play("select.structure");
    }
    if (selectedBarracksIds.size > 0) {
      clearUnitSelection();
      clearHqSelection();
    }
    renderStructuresIfNeeded();
    syncSelectionHint();
  }

  function selectUnits(ids: string[], additive: boolean): void {
    if (!additive) selectedUnitIds.clear();
    let newlySelected = false;
    for (const id of ids) {
      const u = state.units.find((x) => x.instanceId === id);
      if (u && u.ownerId === HUMAN_PLAYER_ID) {
        if (!selectedUnitIds.has(id)) newlySelected = true;
        selectedUnitIds.add(id);
      }
    }
    if (newlySelected) {
      audio.play("select.unit");
    }
    if (selectedUnitIds.size > 0) {
      clearBarracksSelection();
      clearHqSelection();
    }
    renderStructuresIfNeeded();
    syncUnitDom();
    syncSelectionHint();
  }

  function onContextMenu(e: MouseEvent): void {
    if (!options.simEnabled() || paused || selectedBuild || skirmishEnded) return;
    if ((e.target as HTMLElement).closest(".match-footer, .match-hud, .match-build-rail")) return;
    e.preventDefault();

    const rect = viewport.getBoundingClientRect();
    const cam = camera.getCamera();
    const hitR = worldHitRadiusForZoom(cam.zoom);
    const { worldX, worldY } = worldFromClient(e.clientX, e.clientY, rect, cam, worldEl);

    const productionIds = selectedProductionStructureIds();
    if (selectedUnitIds.size === 0 && productionIds.length > 0) {
      state = applyProductionRallyCommand(state, productionIds, worldX, worldY);
      const fromPositions = productionIds
        .map((id) => state.structures.find((s) => s.instanceId === id))
        .filter((s): s is NonNullable<typeof s> => !!s)
        .map((s) => structureCenterPx(s));
      commandVfx.showMove(worldX, worldY, fromPositions);
      syncProductionRallyOverlay();
      audio.play("command.rally");
      options.onSelectionHint?.("Rally point set — newly trained units will move here");
      return;
    }

    if (selectedUnitIds.size === 0) return;

    const fromPositions = [...selectedUnitIds]
      .map((id) => state.units.find((u) => u.instanceId === id))
      .filter((u): u is NonNullable<typeof u> => !!u && u.hp > 0)
      .map((u) => ({ x: u.x, y: u.y }));

    const workerIds = selectedWorkerIds(state, selectedUnitIds, HUMAN_PLAYER_ID);
    if (workerIds.size > 0) {
      const genId = pickFriendlyGeneratorAt(state, worldX, worldY, HUMAN_PLAYER_ID);
      if (genId) {
        state = applyGatherCommand(state, workerIds, genId);
        const c = structureCenterPx(
          state.structures.find((s) => s.instanceId === genId)!,
        );
        commandVfx.showMove(c.x, c.y, fromPositions);
        options.onSelectionHint?.(
          `Workers assigned to generator (${workersAssignedToGenerator(state, genId)}/${MAX_GENERATOR_WORKERS} max)`,
        );
        syncUnitDom();
        return;
      }
    }

    const combatIds = new Set(
      [...selectedUnitIds].filter((id) => {
        const u = state.units.find((x) => x.instanceId === id);
        return u && isCombatUnit(u.defId);
      }),
    );
    if (combatIds.size === 0) {
      state = applyMoveCommand(state, selectedUnitIds, worldX, worldY);
      commandVfx.showMove(worldX, worldY, fromPositions);
      audio.play("command.move");
      return;
    }

    const enemy = pickEnemyTargetAt(state, HUMAN_PLAYER_ID, worldX, worldY, hitR);
    if (enemy) {
      state = applyAttackCommand(state, combatIds, enemy.targetId, enemy.targetKind);
      const center = commandTargetCenter(enemy.targetId, enemy.targetKind);
      if (center) commandVfx.showAttack(center.x, center.y, enemy.targetKind);
    } else {
      state = applyMoveCommand(state, selectedUnitIds, worldX, worldY);
      commandVfx.showMove(worldX, worldY, fromPositions);
      audio.play("command.move");
    }
  }

  const onSpaceKeyDown = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.code === "Space") {
      spaceHeld = true;
      e.preventDefault();
    }
  };
  const onSpaceKeyUp = (e: KeyboardEvent) => {
    if (e.code === "Space") spaceHeld = false;
  };
  window.addEventListener("keydown", onSpaceKeyDown);
  window.addEventListener("keyup", onSpaceKeyUp);

  function onViewportPointerDown(e: PointerEvent): void {
    if (e.button !== 0 || !options.simEnabled() || paused || selectedBuild || skirmishEnded) return;
    if (spaceHeld) return;
    if ((e.target as HTMLElement).closest(".map-zoom-controls, .match-footer, .match-hud, .match-build-rail"))
      return;

    const dom = pickDomTarget(state, e.target, HUMAN_PLAYER_ID);
    if (dom.unitId) {
      selectUnits([dom.unitId], e.shiftKey);
      selecting = false;
      return;
    }
    if (dom.barracksId) {
      selectBarracks([dom.barracksId], e.shiftKey);
      selecting = false;
      return;
    }
    if (dom.hqSelected) {
      selectHq(true);
      selecting = false;
      return;
    }

    const rect = viewport.getBoundingClientRect();
    const cam = camera.getCamera();
    const hitR = worldHitRadiusForZoom(cam.zoom);
    const { worldX, worldY } = worldFromClient(e.clientX, e.clientY, rect, cam, worldEl);
    const unit = pickUnitAt(state, worldX, worldY, HUMAN_PLAYER_ID, hitR);

    if (unit) {
      selectUnits([unit.instanceId], e.shiftKey);
      selecting = false;
      return;
    }

    const barracksId = pickFriendlyBarracksAt(state, worldX, worldY);
    if (barracksId) {
      selectBarracks([barracksId], e.shiftKey);
      selecting = false;
      return;
    }

    const hqId = pickFriendlyHqAt(state, worldX, worldY, HUMAN_PLAYER_ID);
    if (hqId) {
      selectHq(true);
      selecting = false;
      return;
    }

    if (!e.shiftKey) {
      clearBarracksSelection();
      clearHqSelection();
      clearUnitSelection();
      renderStructures();
    }

    selecting = true;
    selectStartX = e.clientX;
    selectStartY = e.clientY;
    selectionBox.classList.add("is-active");
    selectionBox.style.left = `${selectStartX}px`;
    selectionBox.style.top = `${selectStartY}px`;
    selectionBox.style.width = "0";
    selectionBox.style.height = "0";
  }

  function onViewportPointerMove(e: PointerEvent): void {
    if (!selecting) return;
    const x0 = Math.min(selectStartX, e.clientX);
    const y0 = Math.min(selectStartY, e.clientY);
    const w = Math.abs(e.clientX - selectStartX);
    const h = Math.abs(e.clientY - selectStartY);
    selectionBox.style.left = `${x0}px`;
    selectionBox.style.top = `${y0}px`;
    selectionBox.style.width = `${w}px`;
    selectionBox.style.height = `${h}px`;
  }

  function onViewportPointerUp(e: PointerEvent): void {
    if (!selecting) return;
    selecting = false;
    selectionBox.classList.remove("is-active");

    const drag = Math.hypot(e.clientX - selectStartX, e.clientY - selectStartY);
    const rect = viewport.getBoundingClientRect();
    if (drag < 6) return;

    const cam = camera.getCamera();
    const unitIds = unitsInScreenBox(
      state,
      HUMAN_PLAYER_ID,
      selectStartX,
      selectStartY,
      e.clientX,
      e.clientY,
      cam,
      rect,
      worldEl,
    );
    if (unitIds.length > 0) {
      selectUnits(unitIds, e.shiftKey);
      return;
    }

    const barracksIds = barracksInScreenBox(
      state,
      HUMAN_PLAYER_ID,
      selectStartX,
      selectStartY,
      e.clientX,
      e.clientY,
      cam,
      rect,
      worldEl,
    );
    if (barracksIds.length > 0) selectBarracks(barracksIds, e.shiftKey, false);
  }

  function onClick(e: MouseEvent) {
    if (!canPlaceOnMap()) return;
    if ((e.target as HTMLElement).closest(".build-btn, .match-footer, .match-hud")) return;
    if (camera.hadPanGesture()) {
      camera.clearPanGesture();
      return;
    }

    syncBlueprintFromPointer(e.clientX, e.clientY);
    const defId = selectedBuild!;
    const check = canPlaceStructure(state, HUMAN_PLAYER_ID, defId, snapGx, snapGy);
    if (!check.ok) {
      placementHint(check.reason);
      ghostFill.classList.add(P.shake);
      window.setTimeout(() => ghostFill.classList.remove(P.shake), 400);
      return;
    }

    const next = placeStructure(state, HUMAN_PLAYER_ID, defId, snapGx, snapGy);
    if (!next) return;

    state = advancePlayerVision(next);
    const human = state.players.get(HUMAN_PLAYER_ID);
    if (human) options.onMatterChange(human.matter);
    audio.play("purchase.structure");
    spawnPlacementFlash(snapGx, snapGy, defId);
    renderStructures();
    renderHighlight();
    syncFog();
    updateMinimap();
    options.onBuildHint("Construction started…");
  }

  window.addEventListener("pointermove", onGlobalPointerMove);
  viewport.addEventListener("click", onClick);
  viewport.addEventListener("contextmenu", onContextMenu);
  viewport.addEventListener("pointerdown", onViewportPointerDown);
  viewport.addEventListener("pointermove", onViewportPointerMove);
  viewport.addEventListener("pointerup", onViewportPointerUp);
  viewport.addEventListener("pointercancel", onViewportPointerUp);

  renderStructures();
  structureRenderKey = structureSignature();
  for (const s of state.structures) {
    structureBuildTrack.set(s.instanceId, s.buildProgress);
    if (s.defId === "barracks") {
      const first = s.trainQueue[0];
      barracksDeployTrack.set(s.instanceId, {
        activeId: first?.unitDefId ?? null,
        queueLen: s.trainQueue.length,
      });
    }
  }
  syncUnitDom();
  syncStructureActivityVfx();
  unitPresenter.snapAll(unitNodes);
  updateMinimap();
  options.onMatterChange(state.players.get(HUMAN_PLAYER_ID)!.matter);
  options.onUnitCountChange?.(
    countPlayerUnits(state, HUMAN_PLAYER_ID),
    PLAYER_UNIT_CAP,
  );
  options.onBuildHint(
    "HQ: train workers · Build generators on ◆ matter deposits only · Workers gather at built generators (right-click, max 2)",
  );
  selectHq(true, false);
  syncSelectionHint();

  const resizeObserver = new ResizeObserver(() => {
    updateMinimap();
    onCameraMoved?.();
  });
  resizeObserver.observe(viewport);

  return {
    destroy() {
      clearInterval(tickTimer);
      unitPresenter.stop();
      commandVfx.destroy();
      matchFog.destroy();
      resizeObserver.disconnect();
      window.removeEventListener("keydown", onSpaceKeyDown);
      window.removeEventListener("keyup", onSpaceKeyUp);
      window.removeEventListener("pointermove", onGlobalPointerMove);
      viewport.removeEventListener("click", onClick);
      viewport.removeEventListener("contextmenu", onContextMenu);
      viewport.removeEventListener("pointerdown", onViewportPointerDown);
      viewport.removeEventListener("pointermove", onViewportPointerMove);
      viewport.removeEventListener("pointerup", onViewportPointerUp);
      viewport.removeEventListener("pointercancel", onViewportPointerUp);
      selectionBox.remove();
      unregisterMatchDebug();
      wayfinder?.destroy();
      camera.destroy();
      minimap?.destroy();
      entityTooltip.destroy();
    },
    setPaused(p: boolean) {
      paused = p;
      if (paused) hideBlueprint();
      else if (selectedBuild) showBlueprint();
      else syncBuildingMode();
    },
    getSelectedBarracksIds() {
      return [...selectedBarracksIds];
    },
    trainUnit(unitDefId: UnitDefId) {
      if (selectedBarracksIds.size === 0) return false;
      let queued = 0;
      for (const barracksId of selectedBarracksIds) {
        const next = queueTrainAtBarracks(state, barracksId, HUMAN_PLAYER_ID, unitDefId);
        if (!next) continue;
        state = next;
        queued++;
        const node = structureNodes.get(barracksId);
        if (node) {
          node.classList.add("barracks-train-queued-flash");
          window.setTimeout(() => node.classList.remove("barracks-train-queued-flash"), 550);
        }
      }
      if (queued === 0) return false;
      const human = state.players.get(HUMAN_PLAYER_ID);
      if (human) options.onMatterChange(human.matter);
      structureRenderKey = "";
      renderStructuresIfNeeded();
      return true;
    },
    trainWorker() {
      const hqNow = getPlayerHq(state, HUMAN_PLAYER_ID);
      if (!hqNow) return false;
      const next = queueTrainAtHq(state, hqNow.instanceId, HUMAN_PLAYER_ID, "worker");
      if (!next) return false;
      state = next;
      const human = state.players.get(HUMAN_PLAYER_ID);
      if (human) options.onMatterChange(human.matter);
      structureRenderKey = "";
      renderStructuresIfNeeded();
      return true;
    },
    setHqSelected(selected: boolean) {
      selectHq(selected);
    },
    isHqSelected() {
      return hqSelected;
    },
    stopSelectedUnits() {
      stopSelectedUnits();
    },
    selectBuild(id: StructureDefId | null) {
      selectedBuild = id;
      if (id) {
        clearBarracksSelection();
        clearUnitSelection();
        if (!hqSelected) selectHq(true, false);
      }
      syncBuildingMode();
      renderHighlight();
      if (id) {
        showBlueprint();
        placementHint(undefined);
      } else {
        hideBlueprint();
        placementHint(undefined);
      }
    },
    getBuildables: () => BUILDABLE_STRUCTURE_IDS,
    focusHome() {
      const hqNow = getPlayerHq(state, HUMAN_PLAYER_ID);
      if (hqNow) {
        focusCameraWhenReady(viewport, camera, hqNow.gx, hqNow.gy);
        wayfinder?.update();
      }
    },
  };
}
