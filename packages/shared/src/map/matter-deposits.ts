/** Mirrors features/map-terrain/data/matter-deposits-v0.json — keep in sync. */

import type { BuildSimState } from "../structures/building.js";
import { AI_PLAYER_ID, HUMAN_PLAYER_ID } from "../structures/defs.js";
import { footprintOverlapsBarrier } from "./barriers.js";

export type MatterDepositSide = "human" | "ai" | "neutral";

export interface MatterDeposit {
  id: string;
  side: MatterDepositSide;
  gx: number;
  gy: number;
}

/** Matter available from each v0 deposit once a generator is built on it. */
export const MATTER_DEPOSIT_CAPACITY = 1500;

/** Fixed matter nodes in each HQ bowl — one generator per cell. */
export const SKIRMISH_MATTER_DEPOSITS: readonly MatterDeposit[] = [
  { id: "human-m1", side: "human", gx: 14, gy: 62 },
  { id: "human-m2", side: "human", gx: 18, gy: 82 },
  { id: "human-m3", side: "human", gx: 30, gy: 72 },
  { id: "human-m4", side: "human", gx: 38, gy: 68 },
  { id: "human-m5", side: "human", gx: 42, gy: 88 },
  { id: "neutral-flux-nw", side: "neutral", gx: 85, gy: 16 },
  { id: "neutral-flux-ne", side: "neutral", gx: 95, gy: 26 },
  { id: "neutral-flux-mw", side: "neutral", gx: 84, gy: 62 },
  { id: "neutral-flux-me", side: "neutral", gx: 96, gy: 68 },
  { id: "neutral-flux-sw", side: "neutral", gx: 85, gy: 100 },
  { id: "neutral-flux-se", side: "neutral", gx: 95, gy: 110 },
  { id: "ai-m1", side: "ai", gx: 128, gy: 18 },
  { id: "ai-m2", side: "ai", gx: 132, gy: 28 },
  { id: "ai-m3", side: "ai", gx: 145, gy: 20 },
  { id: "ai-m4", side: "ai", gx: 148, gy: 12 },
  { id: "ai-m5", side: "ai", gx: 140, gy: 42 },
] as const;

const depositByCell = new Map(
  SKIRMISH_MATTER_DEPOSITS.map((d) => [`${d.gx},${d.gy}`, d] as const),
);

export function matterDepositSideForPlayer(playerId: string): MatterDepositSide | null {
  if (playerId === HUMAN_PLAYER_ID) return "human";
  if (playerId === AI_PLAYER_ID) return "ai";
  return null;
}

export function matterDepositAt(gx: number, gy: number): MatterDeposit | undefined {
  return depositByCell.get(`${gx},${gy}`);
}

export function isMatterDepositConsumed(
  state: BuildSimState,
  depositId: string,
): boolean {
  return state.consumedMatterDepositIds.includes(depositId);
}

export function remainingMatterForGenerator(
  generator: { defId: string; matterRemaining?: number },
): number {
  if (generator.defId !== "generator") return 0;
  return Math.max(0, generator.matterRemaining ?? MATTER_DEPOSIT_CAPACITY);
}

export function matterDepositRemaining(
  state: BuildSimState,
  depositId: string,
): number {
  const deposit = SKIRMISH_MATTER_DEPOSITS.find((d) => d.id === depositId);
  if (!deposit) return 0;
  const generator = state.structures.find(
    (s) => s.defId === "generator" && s.gx === deposit.gx && s.gy === deposit.gy,
  );
  return generator ? remainingMatterForGenerator(generator) : MATTER_DEPOSIT_CAPACITY;
}

export function matterDepositsForSide(side: MatterDepositSide): readonly MatterDeposit[] {
  return SKIRMISH_MATTER_DEPOSITS.filter((d) => d.side === side);
}

/** Unclaimed matter nodes this player can still build a generator on. */
export function availableMatterDeposits(
  state: BuildSimState,
  playerId: string,
): MatterDeposit[] {
  const side = matterDepositSideForPlayer(playerId);
  if (!side) return [];
  return SKIRMISH_MATTER_DEPOSITS.filter(
    (d) =>
      (d.side === side || d.side === "neutral") &&
      !isMatterDepositConsumed(state, d.id) &&
      !footprintOverlapsBarrier(d.gx, d.gy, { w: 1, h: 1 }),
  );
}

/** Max generators this player can ever have (fixed node count). */
export function maxGeneratorsForPlayer(playerId: string): number {
  const side = matterDepositSideForPlayer(playerId);
  if (!side) return 0;
  return matterDepositsForSide(side).length + matterDepositsForSide("neutral").length;
}

/** True when a 1×1 generator anchor sits on an open matter node for this player. */
export function generatorOnAvailableMatterDeposit(
  state: BuildSimState,
  playerId: string,
  gx: number,
  gy: number,
): boolean {
  const side = matterDepositSideForPlayer(playerId);
  if (!side) return false;
  const deposit = matterDepositAt(gx, gy);
  if (!deposit || (deposit.side !== side && deposit.side !== "neutral")) return false;
  return !isMatterDepositConsumed(state, deposit.id);
}
