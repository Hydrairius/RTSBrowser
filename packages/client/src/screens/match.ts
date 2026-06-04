import {
  BARRACKS_QUEUE_MAX,
  HQ_QUEUE_MAX,
  PLAYER_UNIT_CAP,
  structureDef,
  unitDef,
  type StructureDefId,
  type UnitDefId,
} from "@rtsbrowser/shared";
import { audio, mountAudioSettings, withUiClick } from "../audio/index.js";
import {
  factionById,
  structureDisplayNameForFaction,
  type FactionId,
} from "../data/factions.js";
import { factionThemeClass } from "../game/faction-shapes.js";
import { UNIT_VISUAL } from "../game/unit-visuals.js";
import { mountHudUnitPanel } from "../game/hud-unit-panel.js";
import { mountMatchField } from "../game/match-field.js";
import type { JourneyRouter } from "../navigation/router.js";
import type { MatchOutcome, SkirmishConfig } from "../state/skirmish-config.js";
import { button, el } from "../ui/dom.js";

export interface MatchSession {
  config: SkirmishConfig;
  aiFaction: FactionId;
  startedAt: number;
}

export interface MatchEndPayload {
  outcome: MatchOutcome;
  reason: string;
  durationSec: number;
}

export function mountMatch(
  root: HTMLElement,
  router: JourneyRouter,
  session: MatchSession,
  onEnd: (result: MatchEndPayload) => void,
): () => void {
  root.replaceChildren();
  root.classList.add("match-active");

  const player = factionById(session.config.playerFaction!);
  const ai = factionById(session.aiFaction);

  const hud = el("header", "match-hud");
  const resources = el("div", "hud-resources", ["◆ 400"]);
  const hudCenter = el("div", "hud-center");
  const unitCap = el("div", "hud-unit-cap");
  const unitCapCount = el("span", "hud-unit-cap-count", [`0 / ${PLAYER_UNIT_CAP}`]);
  const unitCapBar = el("div", "hud-unit-cap-bar");
  const unitCapFill = el("div", "hud-unit-cap-fill");
  unitCapBar.append(unitCapFill);
  unitCap.append(
    el("span", "hud-unit-cap-label", ["Units"]),
    unitCapCount,
    unitCapBar,
  );
  const objectives = el("div", "hud-objectives", ["Destroy enemy HQ"]);
  hudCenter.append(unitCap, objectives);
  const menuBtn = button("≡", "hud-menu-btn");
  hud.append(resources, hudCenter, menuBtn);

  const buildRail = el("aside", "match-build-rail");
  buildRail.append(el("h2", "build-rail-title", ["HQ"]));
  const buildRailHint = el("p", "build-rail-hint", [
    "Click your HQ on the map to open build options",
  ]);
  buildRail.append(buildRailHint);
  const hqTrainRail = el("div", "match-hq-train-rail hidden");
  hqTrainRail.append(el("h3", "build-rail-title", ["Workers"]));
  const buildSection = el("div", "build-rail-build-section hidden");
  buildSection.append(el("h3", "build-rail-title", ["Build"]));
  buildSection.append(
    el("p", "build-rail-hint build-rail-hint-inline", [
      "Pick a structure, then click the map · Generators need workers (max 2) to earn ◆",
    ]),
  );
  const buildButtons = el("div", "build-rail-buttons");

  const playArea = el("div", "match-play-area");
  const viewport = el("div", "match-viewport");
  const intro = el("div", "match-intro");
  intro.append(
    el("p", "", [`${player.displayName} vs ${ai.displayName}`]),
    el("p", "match-intro-sub", ["Mission: Destroy enemy HQ"]),
    el("p", "match-intro-sub", [
      "Your HQ is in the blue west — click it to build and train Workers",
    ]),
  );
  playArea.append(buildRail, viewport);
  viewport.append(intro);

  const minimapCard = el("aside", "match-minimap-card");
  minimapCard.append(
    el("div", "match-minimap-card-header", [
      el("span", "match-minimap-card-title", ["Tactical map"]),
      el("span", "match-minimap-card-hint", ["Click to pan"]),
    ]),
  );
  const minimap = el("div", "hud-minimap");
  minimapCard.append(minimap);

  const footer = el("footer", "match-footer");
  const selectionArea = el("div", "hud-selection-area");
  const selectionHint = el("div", "hud-selection-hint", [
    "Drag to select troops · Shift+click Barracks for multi-select",
  ]);
  selectionArea.append(selectionHint);
  const unitPanel = mountHudUnitPanel(selectionArea, {
    onStop: () => field?.stopSelectedUnits(),
  });
  const focusHome = button("⌂ Jump to your HQ", "btn-primary btn-jump-hq");
  footer.append(selectionArea, focusHome);

  let field: ReturnType<typeof mountMatchField> | null = null;

  const overlay = el("div", "overlay pause-overlay hidden");
  const pausePanel = el("div", "overlay-panel");
  pausePanel.append(
    el("h3", "", ["Paused"]),
    button("Resume", "btn-primary"),
    button("Surrender", "btn-secondary"),
    button("Quit to menu", "btn-secondary"),
  );
  mountAudioSettings(pausePanel);
  overlay.append(pausePanel);

  const screen = el("section", "screen screen-match");
  screen.append(hud, playArea, minimapCard, footer, overlay);
  root.append(screen);

  let introDone = false;
  let paused = false;
  let activeBuild: StructureDefId | null = null;

  const trainRail = el("div", "match-train-rail hidden");
  trainRail.append(el("h3", "build-rail-title", ["Train"]));

  field = mountMatchField(viewport, {
    humanFaction: session.config.playerFaction!,
    aiFaction: session.aiFaction,
    minimapHost: minimap,
    onMatterChange(matter) {
      resources.textContent = `◆ ${Math.floor(matter)}`;
    },
    onUnitCountChange(count, cap) {
      unitCapCount.textContent = `${count} / ${cap}`;
      const pct = cap > 0 ? Math.min(100, (count / cap) * 100) : 0;
      unitCapFill.style.width = `${pct}%`;
      unitCap.classList.toggle("hud-unit-cap--full", count >= cap);
      unitCap.classList.toggle("hud-unit-cap--warn", count >= cap * 0.85);
    },
    onBuildHint(hint) {
      selectionHint.textContent = hint;
      selectionHint.classList.remove("hidden");
    },
    onSelectionHint(hint) {
      selectionHint.textContent = hint;
      selectionHint.classList.remove("hidden");
    },
    onUnitSelectionChange(snapshot) {
      unitPanel.update(snapshot);
      selectionHint.classList.toggle("hidden", snapshot !== null);
    },
    onBarracksSelected(ids) {
      trainRail.classList.toggle("hidden", ids.length === 0);
    },
    onHqSelected(selected) {
      hqTrainRail.classList.toggle("hidden", !selected);
      buildSection.classList.toggle("hidden", !selected);
      buildRailHint.classList.toggle("hidden", selected);
    },
    onSkirmishEnd(outcome) {
      if (outcome === "human_victory") endMatch("victory", "Enemy HQ destroyed");
      else endMatch("defeat", "Your HQ was destroyed");
    },
    simEnabled: () => introDone && !paused,
    canPlace: () => introDone && !paused,
    panEnabled: () => !paused,
  });

  for (const defId of field.getBuildables()) {
    const def = structureDef(defId);
    const icon =
      def.id === "generator" ? "⚡" : def.id === "turret" ? "◈" : "▣";
    const buildName = structureDisplayNameForFaction(
      defId,
      session.config.playerFaction!,
    );
    const btn = button("", "build-rail-btn");
    btn.append(
      el("span", "build-rail-icon", [icon]),
      el("span", "build-rail-name", [buildName]),
      el("span", "build-rail-cost", [`◆ ${def.cost}`]),
    );
    btn.onclick = () => {
      activeBuild = activeBuild === defId ? null : defId;
      for (const b of buildButtons.querySelectorAll(".build-rail-btn")) {
        b.classList.toggle("build-rail-btn-active", b === btn && activeBuild === defId);
      }
      field.selectBuild(activeBuild);
      if (activeBuild === defId) audio.play("ui.click");
    };
    buildButtons.append(btn);
  }
  buildSection.append(buildButtons);
  buildRail.append(hqTrainRail, buildSection);

  const workerBtn = button("", "build-rail-btn build-rail-btn-worker");
  workerBtn.append(
    el("span", "build-rail-icon", ["⚙"]),
    el("span", "build-rail-name", ["Worker"]),
    el("span", "build-rail-cost", [`◆ ${unitDef("worker").cost}`]),
  );
  workerBtn.onclick = () => {
    if (field.trainWorker()) {
      audio.play("purchase.worker");
    } else {
      selectionHint.textContent =
        `Cannot train worker — need matter, unit cap (${PLAYER_UNIT_CAP}), or HQ queue full (${HQ_QUEUE_MAX})`;
      selectionHint.classList.remove("hidden");
    }
  };
  hqTrainRail.append(workerBtn);

  trainRail.classList.add(factionThemeClass(player.id));
  trainRail.style.setProperty("--faction-color", player.color);

  for (const unitId of ["striker", "bolter"] as UnitDefId[]) {
    const udef = unitDef(unitId);
    const tag = UNIT_VISUAL[unitId].roleLabel;
    const btn = button("", `train-btn train-btn-${unitId === "striker" ? "melee" : "ranged"}`);
    btn.append(
      el("span", `train-btn-glyph train-btn-glyph--${unitId}`),
      el("span", "train-btn-body", [
        el("span", "", [udef.displayName]),
        el("span", "train-btn-tag", [tag]),
        el("span", "", [`◆ ${udef.cost}`]),
      ]),
    );
    btn.onclick = () => {
      const n = field.getSelectedBarracksIds().length;
      if (field.trainUnit(unitId)) {
        audio.play("purchase.unit");
      } else {
        selectionHint.textContent =
          n > 1
            ? `Cannot train at all ${n} barracks — need matter, unit cap (${PLAYER_UNIT_CAP}), built status, or queue full (${BARRACKS_QUEUE_MAX})`
            : `Cannot train — need matter, unit cap (${PLAYER_UNIT_CAP}), built barracks, or queue full (${BARRACKS_QUEUE_MAX})`;
        selectionHint.classList.remove("hidden");
      }
    };
    trainRail.append(btn);
  }
  buildRail.append(trainRail);

  focusHome.onclick = () => field.focusHome();

  const introTimer = window.setTimeout(() => {
    intro.classList.add("fade-out");
    introDone = true;
    audio.playMusic("music.match");
    window.setTimeout(() => {
      intro.remove();
      field.focusHome();
    }, 600);
  }, 2200);

  const resumeBtn = pausePanel.querySelectorAll("button")[0]!;
  const surrenderBtn = pausePanel.querySelectorAll("button")[1]!;
  const quitBtn = pausePanel.querySelectorAll("button")[2]!;

  menuBtn.onclick = withUiClick(() => {
    paused = true;
    field.setPaused(true);
    overlay.classList.remove("hidden");
  });
  resumeBtn.onclick = withUiClick(() => {
    paused = false;
    field.setPaused(false);
    overlay.classList.add("hidden");
  });
  surrenderBtn.onclick = withUiClick(() => endMatch("defeat", "You surrendered"));
  quitBtn.onclick = withUiClick(() => {
    if (confirm("Quit to main menu? Progress will be lost.")) {
      audio.stopMusic();
      cleanup();
      router.resetTo("title");
    }
  });

  const demoWin = button("Demo: Win", "btn-demo");
  const demoLose = button("Demo: Lose", "btn-demo");
  const demoBar = el("div", "match-demo-bar", [demoWin, demoLose]);
  screen.append(demoBar);

  demoWin.onclick = () => endMatch("victory", "Enemy HQ destroyed", true);
  demoLose.onclick = () => endMatch("defeat", "Your HQ was destroyed", true);

  function endMatch(outcome: MatchOutcome, reason: string, requireIntro = false): void {
    if (requireIntro && !introDone) return;
    audio.stopMusic();
    audio.play(outcome === "victory" ? "sting.victory" : "sting.defeat");
    const durationSec = Math.max(1, Math.round((Date.now() - session.startedAt) / 1000));
    cleanup();
    onEnd({ outcome, reason, durationSec });
    router.dispatch("match-ended");
  }

  function cleanup(): void {
    window.clearTimeout(introTimer);
    field?.destroy();
    root.classList.remove("match-active");
  }

  return cleanup;
}
