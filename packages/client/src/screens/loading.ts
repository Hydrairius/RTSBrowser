import { audio } from "../audio/index.js";
import { FACTIONS, resolveAiFaction } from "../data/factions.js";
import type { JourneyRouter } from "../navigation/router.js";
import type { SkirmishConfig } from "../state/skirmish-config.js";
import { el } from "../ui/dom.js";

const TIPS = FACTIONS.map((f) => `${f.displayName}: ${f.tagline}`);

export function mountLoading(
  root: HTMLElement,
  router: JourneyRouter,
  config: SkirmishConfig,
  onReady: (resolved: { aiFaction: import("../data/factions.js").FactionId }) => void,
): void {
  root.replaceChildren();
  root.classList.remove("match-active");

  const tip = TIPS[Math.floor(Math.random() * TIPS.length)]!;
  const screen = el("section", "screen screen-loading");
  const panel = el("div", "loading-panel");
  const status = el("p", "loading-status", ["Loading assets…"]);
  const barTrack = el("div", "progress-track");
  const barFill = el("div", "progress-fill");
  barTrack.append(barFill);
  panel.append(
    el("header", "screen-header", [
      el("h2", "", ["Preparing battlefield"]),
      el("p", "screen-sub", ["Setting up map, factions, and assets…"]),
    ]),
    barTrack,
    status,
    el("p", "loading-tip", [tip]),
  );
  screen.append(panel);
  root.append(screen);

  const simSteps: { pct: number; label: string; ms: number }[] = [
    { pct: 70, label: "Initializing map…", ms: 400 },
    { pct: 85, label: "Deploying AI opponent…", ms: 350 },
    { pct: 100, label: "Preparing battlefield…", ms: 300 },
  ];

  let simIndex = 0;
  let audioPct = 0;

  const updateBar = () => {
    const simPct =
      simIndex === 0 ? 0 : simSteps[Math.min(simIndex - 1, simSteps.length - 1)]!.pct;
    const blended = Math.round(audioPct * 0.55 + simPct * 0.45);
    barFill.style.width = `${blended}%`;
  };

  const runSimSteps = () => {
    if (simIndex >= simSteps.length) {
      finish();
      return;
    }
    const step = simSteps[simIndex]!;
    status.textContent = step.label;
    simIndex += 1;
    updateBar();
    window.setTimeout(runSimSteps, step.ms);
  };

  const finish = () => {
    const player = config.playerFaction!;
    const aiFaction = resolveAiFaction(config.aiFaction, player);
    onReady({ aiFaction });
    router.dispatch("ready");
  };

  status.textContent = "Loading audio…";
  void audio.preload((pct) => {
    audioPct = pct;
    updateBar();
  }).then(() => {
    status.textContent = "Loading shapes and palette…";
    updateBar();
    window.setTimeout(runSimSteps, 120);
  });
}
