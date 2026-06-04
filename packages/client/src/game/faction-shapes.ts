import { factionById, type FactionId } from "../data/factions.js";

/** CSS class prefix for faction-themed structure rendering. */
export const FACTION_THEME_CLASSES = [
  "faction-theme-triad",
  "faction-theme-loop",
  "faction-theme-block",
] as const;

export function factionThemeClass(id: FactionId): string {
  return `faction-theme-${id}`;
}

export function applyFactionTheme(el: HTMLElement, factionId: FactionId): void {
  for (const c of FACTION_THEME_CLASSES) el.classList.remove(c);
  el.classList.add(factionThemeClass(factionId));
  el.style.setProperty("--faction-color", factionById(factionId).color);
}

export function factionIdForOwner(
  ownerId: string,
  lookup: (playerId: string) => { factionId: string } | undefined,
): FactionId | null {
  const p = lookup(ownerId);
  if (!p) return null;
  return p.factionId as FactionId;
}
