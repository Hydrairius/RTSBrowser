import { mountAudioSettings, unlockAndSyncLandingMusic, withUiClick } from "../audio/index.js";
import { GAME_TITLE } from "../brand.js";
import type { JourneyRouter } from "../navigation/router.js";
import { mountControlsSettings } from "../settings/controls-settings-ui.js";
import { createSettingsTabs } from "../settings/settings-tabs.js";
import { button, el } from "../ui/dom.js";
import { createJourneyBackdrop } from "../ui/journey-shell.js";

export function mountSettings(root: HTMLElement, router: JourneyRouter): void {
  root.replaceChildren();

  const shell = el("div", "settings-shell");

  const header = el("header", "settings-header");
  header.append(
    el("span", "settings-kicker", [GAME_TITLE]),
    el("h2", "settings-title", ["Settings"]),
    el("p", "settings-sub", [
      "Audio and controls. Changes apply immediately where noted and are saved locally.",
    ]),
  );
  shell.append(header);

  const tabs = createSettingsTabs([
    { id: "audio", label: "Audio" },
    { id: "controls", label: "Controls" },
  ]);

  const audioPanel = tabs.getPanel("audio");
  mountAudioSettings(audioPanel, { showTitle: false, showValues: true });

  const controlsPanel = tabs.getPanel("controls");
  mountControlsSettings(controlsPanel);

  const actions = el("div", "settings-actions");
  const backBtn = button("Back", "btn-secondary settings-back-btn");
  actions.append(backBtn);
  shell.append(tabs.root, actions);

  const screen = el("section", "screen screen-settings");
  screen.append(createJourneyBackdrop({ density: "light" }), shell);
  root.append(screen);

  backBtn.onclick = withUiClick(() => router.dispatch("back"));
  screen.addEventListener("click", unlockAndSyncLandingMusic, { once: true });
}
