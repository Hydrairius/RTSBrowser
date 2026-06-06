import type { BarracksProduction } from "../units/types.js";
import { structureMaxHp } from "../units/geometry.js";
import { seedStartingWorkers } from "../units/production.js";
import {
  AI_HQ_SPAWN,
  AI_PLAYER_ID,
  BUILD_RANGE_FROM_HQ,
  HUMAN_HQ_SPAWN,
  HUMAN_PLAYER_ID,
  MAP_COLS,
  MAP_ROWS,
  STARTING_FLUX,
  STARTING_MATTER,
  structureDef,
  zoneForRole,
  type PlayerRole,
  type PlayerZone,
  type StructureDef,
  type StructureDefId,
} from "./defs.js";
import { footprintOverlapsBarrier } from "../map/barriers.js";
import {
  generatorOnAvailableMatterDeposit,
  MATTER_DEPOSIT_CAPACITY,
  matterDepositAt,
} from "../map/matter-deposits.js";
import {
  createFluxObjectiveState,
  extractorOnAvailableFluxObjective,
  FLUX_EXTRACTOR_CAPACITY,
  fluxObjectiveAt,
  SKIRMISH_FLUX_OBJECTIVES,
  type FluxObjectiveState,
} from "../map/flux-objectives.js";
import type { FlowField } from "../map/flow-field.js";
import type { Projectile, Unit } from "../units/types.js";
import {
  advancePlayerVision,
  createVisionForPlayers,
  type VisionState,
} from "../vision/vision.js";

export interface BuildPlayer {
  id: string;
  factionId: string;
  role: PlayerRole;
  matter: number;
  flux: number;
}

export interface PlacedStructure {
  instanceId: string;
  defId: StructureDefId;
  ownerId: string;
  gx: number;
  gy: number;
  /** 0–1; 1 when construction finished. */
  buildProgress: number;
  hp: number;
  maxHp: number;
  /** Barracks only: first entry trains now; rest wait in queue. */
  trainQueue: BarracksProduction[];
  /** HQ / barracks: newly trained units move here after spawning. */
  rallyPoint?: { x: number; y: number };
  /** Turrets only: ticks until next shot. */
  attackCooldown?: number;
  /** Generators only: matter left in the claimed deposit. */
  matterRemaining?: number;
  /** Extractors only: flux left in the claimed objective node. */
  fluxRemaining?: number;
}

export interface BuildSimState {
  tick: number;
  players: Map<string, BuildPlayer>;
  structures: PlacedStructure[];
  units: Unit[];
  projectiles: Projectile[];
  zones: Map<string, PlayerZone>;
  nextInstanceId: number;
  nextUnitId: number;
  nextProjectileId: number;
  /** Cached integration/flow fields keyed by goal + structure revision. */
  flowFields?: Map<string, FlowField>;
  /** Matter node ids claimed by a placed generator (one generator per node). */
  consumedMatterDepositIds: string[];
  /** Neutral flux site ids claimed by a placed extractor (one extractor per site). */
  consumedFluxObjectiveIds: string[];
  /** Neutral objective capture state. */
  fluxObjectives: FluxObjectiveState[];
  /** Per-player fog of war — explored + current LOS. */
  vision?: VisionState;
}

export type PlacementRejectReason =
  | "unknown_def"
  | "not_buildable"
  | "unknown_player"
  | "out_of_bounds"
  | "outside_territory"
  | "overlap"
  | "blocked_terrain"
  | "out_of_range"
  | "max_count"
  | "insufficient_matter"
  | "no_matter_deposit"
  | "matter_deposit_claimed"
  | "no_flux_objective"
  | "flux_objective_not_controlled"
  | "flux_objective_claimed";

export interface PlacementResult {
  ok: boolean;
  reason?: PlacementRejectReason;
}

export interface SpawnConfig {
  playerId: string;
  factionId: string;
  role: PlayerRole;
  hqGx: number;
  hqGy: number;
}

export function createSkirmishBuildState(
  humanFactionId: string,
  aiFactionId: string,
): BuildSimState {
  const seeded = seedStartingWorkers(createBuildSimState([
    {
      playerId: HUMAN_PLAYER_ID,
      factionId: humanFactionId,
      role: "human",
      hqGx: HUMAN_HQ_SPAWN.gx,
      hqGy: HUMAN_HQ_SPAWN.gy,
    },
    {
      playerId: AI_PLAYER_ID,
      factionId: aiFactionId,
      role: "ai",
      hqGx: AI_HQ_SPAWN.gx,
      hqGy: AI_HQ_SPAWN.gy,
    },
  ]));
  return advancePlayerVision(seeded);
}

export function createBuildSimState(spawns: SpawnConfig[]): BuildSimState {
  const players = new Map<string, BuildPlayer>();
  const zones = new Map<string, PlayerZone>();
  const structures: PlacedStructure[] = [];
  let nextInstanceId = 1;

  for (const spawn of spawns) {
    players.set(spawn.playerId, {
      id: spawn.playerId,
      factionId: spawn.factionId,
      role: spawn.role,
      matter: STARTING_MATTER,
      flux: STARTING_FLUX,
    });
    zones.set(spawn.playerId, zoneForRole(spawn.role));
    const hqHp = structureMaxHp("hq");
    structures.push({
      instanceId: `s-${nextInstanceId++}`,
      defId: "hq",
      ownerId: spawn.playerId,
      gx: spawn.hqGx,
      gy: spawn.hqGy,
      buildProgress: 1,
      hp: hqHp,
      maxHp: hqHp,
      trainQueue: [],
    });
  }

  return {
    tick: 0,
    players,
    structures,
    units: [],
    projectiles: [],
    zones,
    nextInstanceId,
    nextUnitId: 1,
    nextProjectileId: 1,
    consumedMatterDepositIds: [],
    consumedFluxObjectiveIds: [],
    fluxObjectives: createFluxObjectiveState(),
    vision: createVisionForPlayers(spawns.map((s) => s.playerId)),
  };
}

export function getPlayerHq(
  state: BuildSimState,
  playerId: string,
): PlacedStructure | undefined {
  return state.structures.find((s) => s.ownerId === playerId && s.defId === "hq");
}

export function canPlaceStructure(
  state: BuildSimState,
  playerId: string,
  defId: StructureDefId,
  gx: number,
  gy: number,
): PlacementResult {
  let def: StructureDef;
  try {
    def = structureDef(defId);
  } catch {
    return { ok: false, reason: "unknown_def" };
  }

  if (def.id === "hq") return { ok: false, reason: "not_buildable" };

  const player = state.players.get(playerId);
  if (!player) return { ok: false, reason: "unknown_player" };

  const zone = state.zones.get(playerId);
  if (!zone) return { ok: false, reason: "outside_territory" };

  if (def.maxPerPlayer) {
    const count = state.structures.filter(
      (s) => s.ownerId === playerId && s.defId === defId,
    ).length;
    if (count >= def.maxPerPlayer) return { ok: false, reason: "max_count" };
  }

  if (!footprintInBounds(gx, gy, def.footprint)) {
    return { ok: false, reason: "out_of_bounds" };
  }

  const placingExtractor = defId === "extractor";
  if (!placingExtractor && !footprintInZone(gx, gy, def.footprint, zone)) {
    return { ok: false, reason: "outside_territory" };
  }

  if (footprintOverlapsBarrier(gx, gy, def.footprint)) {
    return { ok: false, reason: "blocked_terrain" };
  }

  if (defId === "generator") {
    const deposit = matterDepositAt(gx, gy);
    if (!deposit) return { ok: false, reason: "no_matter_deposit" };
    if (!generatorOnAvailableMatterDeposit(state, playerId, gx, gy)) {
      return { ok: false, reason: "matter_deposit_claimed" };
    }
  }

  if (defId === "extractor") {
    const site = fluxObjectiveAt(gx, gy);
    if (!site) return { ok: false, reason: "no_flux_objective" };
    if (!extractorOnAvailableFluxObjective(state, playerId, gx, gy)) {
      return {
        ok: false,
        reason: state.consumedFluxObjectiveIds.includes(site.id)
          ? "flux_objective_claimed"
          : "flux_objective_not_controlled",
      };
    }
  }

  if (footprintOverlapsAny(state, gx, gy, def.footprint)) {
    return { ok: false, reason: "overlap" };
  }

  const hq = getPlayerHq(state, playerId);
  if (!hq) return { ok: false, reason: "out_of_range" };
  if (!placingExtractor && !withinBuildRange(hq, gx, gy, def.footprint)) {
    return { ok: false, reason: "out_of_range" };
  }

  if (player.matter < def.cost) {
    return { ok: false, reason: "insufficient_matter" };
  }

  return { ok: true };
}

export function placeStructure(
  state: BuildSimState,
  playerId: string,
  defId: StructureDefId,
  gx: number,
  gy: number,
): BuildSimState | null {
  const check = canPlaceStructure(state, playerId, defId, gx, gy);
  if (!check.ok) return null;

  const def = structureDef(defId);
  const player = state.players.get(playerId)!;

  const players = new Map(state.players);
  players.set(playerId, { ...player, matter: player.matter - def.cost });

  const built = def.buildTimeTicks === 0;
  const maxHp = structureMaxHp(defId);
  const deposit =
    defId === "generator" ? matterDepositAt(gx, gy) : undefined;
  const fluxSite =
    defId === "extractor" ? fluxObjectiveAt(gx, gy) : undefined;
  const consumedMatterDepositIds = deposit
    ? [...state.consumedMatterDepositIds, deposit.id]
    : state.consumedMatterDepositIds;
  const consumedFluxObjectiveIds = fluxSite
    ? [...state.consumedFluxObjectiveIds, fluxSite.id]
    : state.consumedFluxObjectiveIds;
  const structures = [
    ...state.structures,
    {
      instanceId: `s-${state.nextInstanceId}`,
      defId,
      ownerId: playerId,
      gx,
      gy,
      buildProgress: built ? 1 : 0,
      hp: built ? maxHp : 0,
      maxHp,
      trainQueue: [],
      matterRemaining: deposit ? MATTER_DEPOSIT_CAPACITY : undefined,
      fluxRemaining: fluxSite ? FLUX_EXTRACTOR_CAPACITY : undefined,
    },
  ];

  return {
    tick: state.tick,
    players,
    structures,
    units: state.units,
    projectiles: state.projectiles,
    zones: state.zones,
    nextInstanceId: state.nextInstanceId + 1,
    nextUnitId: state.nextUnitId,
    nextProjectileId: state.nextProjectileId,
    flowFields: state.flowFields,
    consumedMatterDepositIds,
    consumedFluxObjectiveIds,
    fluxObjectives: state.fluxObjectives,
    vision: state.vision,
  };
}

/** Advance one build tick (generator income is applied by worker gather in construction). */
export function advanceBuildTick(state: BuildSimState): BuildSimState {
  const players = new Map(
    [...state.players.entries()].map(([id, p]) => [id, { ...p }]),
  );
  const structures = state.structures.map((s) => ({ ...s }));

  return {
    tick: state.tick + 1,
    players,
    structures,
    units: state.units,
    projectiles: state.projectiles,
    zones: state.zones,
    nextInstanceId: state.nextInstanceId,
    nextUnitId: state.nextUnitId,
    nextProjectileId: state.nextProjectileId,
    flowFields: state.flowFields,
    consumedMatterDepositIds: state.consumedMatterDepositIds,
    consumedFluxObjectiveIds: state.consumedFluxObjectiveIds,
    fluxObjectives: state.fluxObjectives,
    vision: state.vision,
  };
}

export function countStructures(
  state: BuildSimState,
  playerId: string,
  defId: StructureDefId,
): number {
  return state.structures.filter((s) => s.ownerId === playerId && s.defId === defId)
    .length;
}

function footprintInBounds(gx: number, gy: number, fp: { w: number; h: number }): boolean {
  return gx >= 0 && gy >= 0 && gx + fp.w <= MAP_COLS && gy + fp.h <= MAP_ROWS;
}

function footprintInZone(
  gx: number,
  gy: number,
  fp: { w: number; h: number },
  zone: PlayerZone,
): boolean {
  return (
    gx >= zone.minGx &&
    gy >= zone.minGy &&
    gx + fp.w <= zone.maxGx &&
    gy + fp.h <= zone.maxGy
  );
}

function footprintOverlapsAny(
  state: BuildSimState,
  gx: number,
  gy: number,
  fp: { w: number; h: number },
): boolean {
  for (const other of state.structures) {
    const odef = structureDef(other.defId);
    if (rectsOverlap(gx, gy, fp.w, fp.h, other.gx, other.gy, odef.footprint.w, odef.footprint.h)) {
      return true;
    }
  }
  return false;
}

function rectsOverlap(
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

function withinBuildRange(
  hq: PlacedStructure,
  gx: number,
  gy: number,
  fp: { w: number; h: number },
): boolean {
  const hqDef = structureDef("hq");
  const hqCx = hq.gx + hqDef.footprint.w / 2;
  const hqCy = hq.gy + hqDef.footprint.h / 2;
  const placeCx = gx + fp.w / 2;
  const placeCy = gy + fp.h / 2;
  const dist = Math.max(Math.abs(placeCx - hqCx), Math.abs(placeCy - hqCy));
  return dist <= BUILD_RANGE_FROM_HQ;
}

/** Cells where the human can place the current structure footprint (UI highlight). */
export function buildRangeCells(
  state: BuildSimState,
  playerId: string,
  defId: StructureDefId,
): Set<string> {
  const cells = new Set<string>();
  if (defId === "extractor") {
    for (const site of SKIRMISH_FLUX_OBJECTIVES) {
      if (canPlaceStructure(state, playerId, defId, site.gx, site.gy).ok) {
        cells.add(`${site.gx},${site.gy}`);
      }
    }
    return cells;
  }
  const zone = state.zones.get(playerId);
  if (!zone) return cells;

  const def = structureDef(defId);
  for (let gy = zone.minGy; gy <= zone.maxGy - def.footprint.h; gy++) {
    for (let gx = zone.minGx; gx <= zone.maxGx - def.footprint.w; gx++) {
      if (canPlaceStructure(state, playerId, defId, gx, gy).ok) {
        for (let dy = 0; dy < def.footprint.h; dy++) {
          for (let dx = 0; dx < def.footprint.w; dx++) {
            cells.add(`${gx + dx},${gy + dy}`);
          }
        }
      }
    }
  }
  return cells;
}
