import { mountAudioSettings, unlockAndSyncLandingMusic, withUiClick } from "../audio/index.js";
import { GAME_TITLE } from "../brand.js";
import type { JourneyRouter } from "../navigation/router.js";
import { button, el } from "../ui/dom.js";
import { createJourneyBackdrop } from "../ui/journey-shell.js";

export function mountSettings(root: HTMLElement, router: JourneyRouter): void {
  root.replaceChildren();

  const shell = el("div", "settings-shell");

  const header = el("header", "settings-header");
  header.append(
    el("span", "settings-kicker", [GAME_TITLE]),
    el("h2", "settings-title", ["Settings"]),
    el("p", "settings-sub", ["Adjust audio levels. Changes apply immediately and are saved locally."]),
  );
  shell.append(header);

  const audioPanel = el("div", "settings-panel");
  audioPanel.append(el("h3", "settings-label", ["Audio"]));
  mountAudioSettings(audioPanel, { showTitle: false, showValues: true });

  const actions = el("div", "settings-actions");
  const backBtn = button("Back", "btn-secondary settings-back-btn");
  actions.append(backBtn);
  shell.append(audioPanel, actions);

  const screen = el("section", "screen screen-settings");
  screen.append(createJourneyBackdrop({ density: "light" }), shell);
  root.append(screen);

  backBtn.onclick = withUiClick(() => router.dispatch("back"));
  screen.addEventListener("click", unlockAndSyncLandingMusic, { once: true });
}
