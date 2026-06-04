import { withUiClick } from "../audio/index.js";
import { GAME_TITLE } from "../brand.js";
import { FACTIONS, factionById, type FactionDef } from "../data/factions.js";
import type { JourneyRouter } from "../navigation/router.js";
import {
  cloneConfig,
  persistLastFaction,
  type Difficulty,
  type SkirmishConfig,
} from "../state/skirmish-config.js";
import { button, el } from "../ui/dom.js";
import { createJourneyBackdrop } from "../ui/journey-shell.js";

export interface SkirmishSetupHandlers {
  getConfig: () => SkirmishConfig;
  setConfig: (config: SkirmishConfig) => void;
}

function factionCard(
  faction: FactionDef,
  selected: boolean,
  onSelect: () => void,
  onPreview?: () => void,
  onPreviewEnd?: () => void,
): HTMLElement {
  const card = el("button", `faction-card${selected ? " selected" : ""}`);
  card.type = "button";
  card.style.setProperty("--faction-color", faction.color);
  card.append(
    el("span", `faction-shape faction-shape-${faction.id}`, [faction.shapeSymbol]),
    el("span", "faction-name", [faction.displayName]),
    el("span", "faction-tag", [faction.tagline]),
  );
  card.onclick = onSelect;
  if (onPreview) card.onmouseenter = onPreview;
  if (onPreviewEnd) card.onmouseleave = onPreviewEnd;
  return card;
}

function mountFactionLoreCard(host: HTMLElement, faction: FactionDef | null): void {
  host.replaceChildren();
  host.style.removeProperty("--faction-color");

  if (!faction) {
    host.classList.add("faction-lore-empty");
    host.append(
      el("span", "faction-lore-kicker", ["Faction dossier"]),
      el("p", "faction-lore-placeholder", [
        "Select a faction to read their briefing and field doctrine.",
      ]),
    );
    return;
  }

  host.classList.remove("faction-lore-empty");
  host.style.setProperty("--faction-color", faction.color);
  host.append(
    el("span", "faction-lore-kicker", ["Faction dossier"]),
    el("div", "faction-lore-header", [
      el("span", `faction-shape faction-shape-${faction.id} faction-lore-shape`, [
        faction.shapeSymbol,
      ]),
      el("div", "faction-lore-titles", [
        el("span", "faction-lore-name", [faction.displayName]),
        el("span", "faction-lore-tagline", [faction.tagline]),
      ]),
    ]),
    el("p", "faction-lore-description", [faction.description]),
    el("span", "faction-lore-story-label", ["Background"]),
    el("p", "faction-lore-story", [faction.backgroundStory]),
  );
}

export function mountSkirmishSetup(
  root: HTMLElement,
  router: JourneyRouter,
  handlers: SkirmishSetupHandlers,
): void {
  root.replaceChildren();
  let config = cloneConfig(handlers.getConfig());

  const shell = el("div", "setup-shell");

  const header = el("header", "setup-header");
  header.append(
    el("span", "setup-kicker", [GAME_TITLE]),
    el("h2", "setup-title", ["Skirmish briefing"]),
    el("p", "setup-sub", ["Choose your faction and deploy against the AI."]),
  );
  shell.append(header);

  const playerSection = el("div", "setup-panel");
  playerSection.append(el("h3", "setup-label", ["Your faction"]));
  const playerRow = el("div", "setup-player-row");
  const playerLore = el("aside", "faction-lore-card faction-lore-empty");
  const playerCards = el("div", "faction-grid setup-player-grid");
  playerRow.append(playerLore, playerCards);
  playerSection.append(playerRow);

  const aiSection = el("div", "setup-panel");
  aiSection.append(el("h3", "setup-label", ["AI opponent"]));
  const aiCards = el("div", "faction-grid");
  aiSection.append(aiCards);

  const options = el("div", "setup-panel setup-panel-options");
  const mapField = el("div", "setup-field");
  const mapLabel = el("label", "", ["Map"]);
  const mapSelect = el("select", "");
  const mapOpt = el("option", "", ["Skirmish Alpha"]) as HTMLOptionElement;
  mapOpt.value = "skirmish-alpha";
  mapSelect.append(mapOpt);
  (mapSelect as HTMLSelectElement).value = config.mapId;
  mapField.append(mapLabel, mapSelect);

  const diffField = el("div", "setup-field");
  const diffLabel = el("label", "", ["Difficulty"]);
  const diffSelect = el("select", "");
  for (const d of ["easy", "normal", "hard"] as Difficulty[]) {
    const opt = el("option", "", [d.charAt(0).toUpperCase() + d.slice(1)]);
    (opt as HTMLOptionElement).value = d;
    diffSelect.append(opt);
  }
  (diffSelect as HTMLSelectElement).value = config.difficulty;
  diffField.append(diffLabel, diffSelect);

  const optionsGrid = el("div", "setup-options");
  optionsGrid.append(mapField, diffField);
  options.append(optionsGrid);

  const actions = el("div", "setup-actions");
  const backBtn = button("Back", "btn-secondary setup-back-btn");
  const startBtn = button("Start match", "btn-primary btn-lg setup-start-btn");
  startBtn.disabled = config.playerFaction === null;
  actions.append(backBtn, startBtn);

  shell.append(playerSection, aiSection, options, actions);

  const screen = el("section", "screen screen-setup");
  screen.append(createJourneyBackdrop({ density: "light" }), shell);
  root.append(screen);

  const renderPlayerLore = (previewId: FactionDef["id"] | null = null) => {
    const id = previewId ?? config.playerFaction;
    mountFactionLoreCard(playerLore, id ? factionById(id) : null);
  };

  const renderPlayerCards = () => {
    playerCards.replaceChildren();
    for (const f of FACTIONS) {
      playerCards.append(
        factionCard(
          f,
          config.playerFaction === f.id,
          () => {
            config = { ...config, playerFaction: f.id };
            persistLastFaction(f.id);
            handlers.setConfig(cloneConfig(config));
            startBtn.disabled = false;
            renderPlayerCards();
            renderPlayerLore();
          },
          () => renderPlayerLore(f.id),
          () => renderPlayerLore(),
        ),
      );
    }
  };

  const renderAiCards = () => {
    aiCards.replaceChildren();
    const randomCard = el("button", `faction-card${config.aiFaction === "random" ? " selected" : ""}`);
    randomCard.type = "button";
    randomCard.style.setProperty("--faction-color", "var(--accent)");
    randomCard.append(
      el("span", "faction-shape faction-shape-random", ["?"]),
      el("span", "faction-name", ["Random"]),
      el("span", "faction-tag", ["Surprise opponent"]),
    );
    randomCard.onclick = () => {
      config = { ...config, aiFaction: "random" };
      handlers.setConfig(cloneConfig(config));
      renderAiCards();
    };
    aiCards.append(randomCard);

    for (const f of FACTIONS) {
      aiCards.append(
        factionCard(f, config.aiFaction === f.id, () => {
          config = { ...config, aiFaction: f.id };
          handlers.setConfig(cloneConfig(config));
          renderAiCards();
        }),
      );
    }
  };

  mapSelect.onchange = () => {
    config = { ...config, mapId: (mapSelect as HTMLSelectElement).value };
    handlers.setConfig(cloneConfig(config));
  };
  diffSelect.onchange = () => {
    config = { ...config, difficulty: (diffSelect as HTMLSelectElement).value as Difficulty };
    handlers.setConfig(cloneConfig(config));
  };

  backBtn.onclick = withUiClick(() => router.dispatch("back"));
  startBtn.onclick = withUiClick(() => {
    if (!config.playerFaction) return;
    handlers.setConfig(cloneConfig(config));
    router.dispatch("start-match");
  });

  renderPlayerCards();
  renderPlayerLore();
  renderAiCards();
}
