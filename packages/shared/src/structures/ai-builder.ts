import { aiStructureGoal, scoreAiBuildSite } from "../ai/policy.js";
import { AI_BUILD_INTERVAL_TICKS, AI_PLAYER_ID, structureDef, type StructureDefId } from "./defs.js";
import {
  advanceBuildTick,
  canPlaceStructure,
  placeStructure,
  type BuildSimState,
} from "./building.js";
import type { PlacedStructure } from "./building.js";

export function aiStructurePriority(state: BuildSimState, playerId: string): StructureDefId | null {
  return aiStructureGoal(state, playerId, state.tick);
}

function bestBuildSite(
  state: BuildSimState,
  playerId: string,
  defId: StructureDefId,
  zone: { minGx: number; maxGx: number; minGy: number; maxGy: number },
  hq: PlacedStructure,
): { gx: number; gy: number } | null {
  const fp = structureDef(defId).footprint;
  let best: { gx: number; gy: number; score: number } | null = null;

  for (let gy = zone.minGy; gy <= zone.maxGy - fp.h; gy++) {
    for (let gx = zone.minGx; gx <= zone.maxGx - fp.w; gx++) {
      if (!canPlaceStructure(state, playerId, defId, gx, gy).ok) continue;
      const score = scoreAiBuildSite(gx, gy, zone, hq, fp);
      if (!best || score > best.score) {
        best = { gx, gy, score };
      }
    }
  }

  return best ? { gx: best.gx, gy: best.gy } : null;
}

export function aiTryPlaceStructure(
  state: BuildSimState,
  playerId: string,
  defId: StructureDefId,
): BuildSimState {
  const zone = state.zones.get(playerId);
  const hq = state.structures.find((s) => s.ownerId === playerId && s.defId === "hq");
  if (!zone || !hq) return state;

  const site = bestBuildSite(state, playerId, defId, zone, hq);
  if (!site) return state;

  const next = placeStructure(state, playerId, defId, site.gx, site.gy);
  return next ?? state;
}

export function advanceBuildTickWithAi(state: BuildSimState): BuildSimState {
  let next = advanceBuildTick(state);

  if (next.tick % AI_BUILD_INTERVAL_TICKS !== 0) return next;

  const defId = aiStructurePriority(next, AI_PLAYER_ID);
  if (!defId) return next;

  return aiTryPlaceStructure(next, AI_PLAYER_ID, defId);
}
