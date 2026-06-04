import type { FactionId } from "../data/factions.js";



/**

 * Runtime theme helpers — CSS custom properties are defined in styles/tokens.css.

 * Design source of truth: features/ui-hud/data/universal-theme.json

 */



/** CSS var references for faction accent (use with setProperty / inline style). */

export const FACTION_COLOR_VAR: Record<FactionId, string> = {

  triad: "var(--triad)",

  loop: "var(--loop)",

  block: "var(--block)",

};



/** Raw hex aligned with :root faction tokens (canvas, tests, exports). */

export const FACTION_HEX: Record<FactionId, string> = {

  triad: "#e85d4a",

  loop: "#4a9eff",

  block: "#c9a227",

};



export const THEME = {

  bg: "#0f1419",

  panel: "#1a2332",

  text: "#e8eef4",

  muted: "#8b9cb3",

  accent: "#4a9eff",

  ok: "#3dd68c",

  warn: "#f5a623",

  err: "#ff6b6b",

  border: "#2d3a4d",

  borderStrong: "#3d5168",

  borderFocus: "#5eb3ff",

  loop: "#4a9eff",

  playerHuman: "#5eb3ff",

  playerAi: "#e85d4a",

} as const;



export function factionColorVar(id: FactionId): string {

  return FACTION_COLOR_VAR[id];

}


