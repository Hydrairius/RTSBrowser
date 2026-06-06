import type { BuildSimState } from "../structures/building.js";
import { AI_PLAYER_ID, CELL_PX, HUMAN_PLAYER_ID } from "../structures/defs.js";
import { isCombatUnit } from "../units/defs.js";
import { distPx, unitAlive } from "../units/geometry.js";

export interface FluxObjectiveSite {
  id: string;
  label: string;
  gx: number;
  gy: number;
  radiusCells: number;
}

export interface FluxObjectiveState {
  siteId: string;
  ownerId: string | null;
  capturePlayerId: string | null;
  captureProgress: number;
}

export const FLUX_CAPTURE_TICKS = 50;
export const FLUX_EXTRACTOR_CAPACITY = 600;

export const SKIRMISH_FLUX_OBJECTIVES: readonly FluxObjectiveSite[] = [
  { id: "flux-north", label: "North Flux Site", gx: 88, gy: 22, radiusCells: 5 },
  { id: "flux-mid", label: "Mid Flux Site", gx: 90, gy: 66, radiusCells: 6 },
  { id: "flux-south", label: "South Flux Site", gx: 88, gy: 106, radiusCells: 5 },
] as const;

const siteByCell = new Map(
  SKIRMISH_FLUX_OBJECTIVES.map((s) => [`${s.gx},${s.gy}`, s] as const),
);

export function createFluxObjectiveState(): FluxObjectiveState[] {
  return SKIRMISH_FLUX_OBJECTIVES.map((site) => ({
    siteId: site.id,
    ownerId: null,
    capturePlayerId: null,
    captureProgress: 0,
  }));
}

export function fluxObjectiveAt(gx: number, gy: number): FluxObjectiveSite | undefined {
  return siteByCell.get(`${gx},${gy}`);
}

export function fluxObjectiveState(
  state: BuildSimState,
  siteId: string,
): FluxObjectiveState | undefined {
  return state.fluxObjectives.find((o) => o.siteId === siteId);
}

export function isFluxObjectiveConsumed(state: BuildSimState, siteId: string): boolean {
  return state.consumedFluxObjectiveIds.includes(siteId);
}

export function remainingFluxForExtractor(
  extractor: { defId: string; fluxRemaining?: number },
): number {
  if (extractor.defId !== "extractor") return 0;
  return Math.max(0, extractor.fluxRemaining ?? FLUX_EXTRACTOR_CAPACITY);
}

export function extractorOnAvailableFluxObjective(
  state: BuildSimState,
  playerId: string,
  gx: number,
  gy: number,
): boolean {
  const site = fluxObjectiveAt(gx, gy);
  if (!site || isFluxObjectiveConsumed(state, site.id)) return false;
  const objective = fluxObjectiveState(state, site.id);
  return objective?.ownerId === playerId;
}

export function availableFluxObjectives(
  state: BuildSimState,
  playerId: string,
): FluxObjectiveSite[] {
  return SKIRMISH_FLUX_OBJECTIVES.filter((site) => {
    if (isFluxObjectiveConsumed(state, site.id)) return false;
    return fluxObjectiveState(state, site.id)?.ownerId === playerId;
  });
}

export function fluxObjectiveRemaining(state: BuildSimState, siteId: string): number {
  const site = SKIRMISH_FLUX_OBJECTIVES.find((s) => s.id === siteId);
  if (!site) return 0;
  const extractor = state.structures.find(
    (s) => s.defId === "extractor" && s.gx === site.gx && s.gy === site.gy,
  );
  return extractor ? remainingFluxForExtractor(extractor) : FLUX_EXTRACTOR_CAPACITY;
}

export function objectiveControlledByExtractorOwner(
  state: BuildSimState,
  extractor: { defId: string; ownerId: string; gx: number; gy: number },
): boolean {
  if (extractor.defId !== "extractor") return false;
  const site = fluxObjectiveAt(extractor.gx, extractor.gy);
  if (!site) return false;
  return fluxObjectiveState(state, site.id)?.ownerId === extractor.ownerId;
}

export function fluxObjectiveCenterPx(site: FluxObjectiveSite): { x: number; y: number } {
  return {
    x: site.gx * CELL_PX + CELL_PX / 2,
    y: site.gy * CELL_PX + CELL_PX / 2,
  };
}

function exclusiveCapturingPlayer(state: BuildSimState, site: FluxObjectiveSite): string | null {
  const center = fluxObjectiveCenterPx(site);
  const radius = site.radiusCells * CELL_PX;
  let humanPresent = false;
  let aiPresent = false;

  for (const u of state.units) {
    if (!unitAlive(u) || !isCombatUnit(u.defId)) continue;
    if (distPx(u.x, u.y, center.x, center.y) > radius) continue;
    if (u.ownerId === HUMAN_PLAYER_ID) humanPresent = true;
    if (u.ownerId === AI_PLAYER_ID) aiPresent = true;
  }

  if (humanPresent === aiPresent) return null;
  return humanPresent ? HUMAN_PLAYER_ID : AI_PLAYER_ID;
}

export function advanceFluxObjectiveControl(state: BuildSimState): BuildSimState {
  const objectives = state.fluxObjectives.map((objective) => {
    const site = SKIRMISH_FLUX_OBJECTIVES.find((s) => s.id === objective.siteId);
    if (!site) return objective;

    const capturingPlayerId = exclusiveCapturingPlayer(state, site);
    if (!capturingPlayerId) {
      return {
        ...objective,
        captureProgress: Math.max(0, objective.captureProgress - 1),
      };
    }

    if (capturingPlayerId === objective.ownerId) {
      return { ...objective, capturePlayerId: null, captureProgress: 0 };
    }

    const continued = objective.capturePlayerId === capturingPlayerId;
    const captureProgress = continued ? objective.captureProgress + 1 : 1;
    if (captureProgress >= FLUX_CAPTURE_TICKS) {
      return {
        ...objective,
        ownerId: capturingPlayerId,
        capturePlayerId: null,
        captureProgress: 0,
      };
    }

    return { ...objective, capturePlayerId: capturingPlayerId, captureProgress };
  });

  return { ...state, fluxObjectives: objectives };
}
