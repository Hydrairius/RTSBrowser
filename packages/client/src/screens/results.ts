import { withUiClick } from "../audio/index.js";
import { factionById } from "../data/factions.js";import type { JourneyRouter } from "../navigation/router.js";
import type { MatchResult, SkirmishConfig } from "../state/skirmish-config.js";
import { button, el } from "../ui/dom.js";

export function mountResults(
  root: HTMLElement,
  router: JourneyRouter,
  config: SkirmishConfig,
  result: MatchResult,
): void {
  root.replaceChildren();

  const won = result.outcome === "victory";
  const player = config.playerFaction ? factionById(config.playerFaction) : null;

  const screen = el("section", `screen screen-results ${won ? "victory" : "defeat"}`);
  const motif = el("div", "results-motif");
  if (player) {
    motif.style.setProperty("--faction-color", player.color);
    motif.textContent = player.shapeSymbol;
  }

  const headline = won ? "VICTORY" : "DEFEAT";
  const mins = Math.floor(result.durationSec / 60);
  const secs = result.durationSec % 60;
  const timeStr = `${mins}:${secs.toString().padStart(2, "0")}`;

  screen.append(
    motif,
    el("h2", "results-headline", [headline]),
    el("p", "results-reason", [result.reason]),
    el("dl", "results-stats", [
      el("div", "stat-row", [el("dt", "", ["Match time"]), el("dd", "", [timeStr])]),
      el("div", "stat-row", [el("dt", "", ["Units lost"]), el("dd", "", ["—"])]),
      el("div", "stat-row", [el("dt", "", ["Units produced"]), el("dd", "", ["—"])]),
    ]),
  );

  const actions = el("div", "screen-actions");
  const rematchBtn = button("Rematch", "btn-primary");
  const settingsBtn = button("Settings", "btn-secondary");
  const menuBtn = button("Main menu", "btn-secondary");
  actions.append(rematchBtn, settingsBtn, menuBtn);
  screen.append(actions);
  root.append(screen);

  rematchBtn.onclick = withUiClick(() => router.dispatch("rematch"));
  settingsBtn.onclick = withUiClick(() => router.dispatch("open-settings"));
  menuBtn.onclick = withUiClick(() => router.dispatch("main-menu"));
}
