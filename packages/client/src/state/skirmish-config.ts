import type { FactionId } from "../data/factions.js";

export type Difficulty = "easy" | "normal" | "hard";

export interface SkirmishConfig {
  playerFaction: FactionId | null;
  aiFaction: FactionId | "random";
  mapId: string;
  difficulty: Difficulty;
}

export type MatchOutcome = "victory" | "defeat";

export interface MatchResult {
  outcome: MatchOutcome;
  reason: string;
  durationSec: number;
}

const LAST_FACTION_KEY = "rts.lastFaction";

export function defaultSkirmishConfig(): SkirmishConfig {
  const last = localStorage.getItem(LAST_FACTION_KEY) as FactionId | null;
  const validLast = last === "triad" || last === "loop" || last === "block" ? last : "triad";
  return {
    playerFaction: validLast,
    aiFaction: "random",
    mapId: "skirmish-alpha",
    difficulty: "normal",
  };
}

export function persistLastFaction(id: FactionId): void {
  localStorage.setItem(LAST_FACTION_KEY, id);
}

export function cloneConfig(config: SkirmishConfig): SkirmishConfig {
  return { ...config };
}
