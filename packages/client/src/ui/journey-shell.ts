import { el } from "./dom.js";

export const JOURNEY_ATTRACT_SHAPES = [
  { shape: 0, size: 56, top: "8%", left: "6%", duration: 20, delay: 0 },
  { shape: 1, size: 72, top: "62%", left: "82%", duration: 24, delay: -4 },
  { shape: 2, size: 44, top: "28%", left: "72%", duration: 28, delay: -8 },
  { shape: 0, size: 36, top: "78%", left: "18%", duration: 22, delay: -2 },
  { shape: 1, size: 52, top: "14%", left: "58%", duration: 26, delay: -6 },
  { shape: 2, size: 64, top: "44%", left: "4%", duration: 30, delay: -10 },
  { shape: 0, size: 28, top: "52%", left: "46%", duration: 18, delay: -3 },
  { shape: 1, size: 40, top: "22%", left: "28%", duration: 21, delay: -7 },
  { shape: 2, size: 48, top: "68%", left: "52%", duration: 25, delay: -5 },
  { shape: 0, size: 32, top: "36%", left: "88%", duration: 19, delay: -1 },
  { shape: 1, size: 60, top: "86%", left: "68%", duration: 27, delay: -9 },
  { shape: 2, size: 38, top: "6%", left: "38%", duration: 23, delay: -11 },
] as const;

const SETUP_ATTRACT_INDICES = [0, 2, 4, 7, 9] as const;

export interface JourneyBackdropOptions {
  /** Full shape field (title) vs a lighter subset (setup). */
  density?: "full" | "light";
}

export function createJourneyBackdrop(options: JourneyBackdropOptions = {}): HTMLElement {
  const density = options.density ?? "full";
  const wrap = el("div", `journey-backdrop${density === "light" ? " journey-backdrop-light" : ""}`);

  const bg = el("div", "journey-bg");
  bg.append(
    el("div", "journey-bg-glow journey-bg-glow-triad"),
    el("div", "journey-bg-glow journey-bg-glow-loop"),
    el("div", "journey-bg-glow journey-bg-glow-block"),
    el("div", "journey-bg-grid"),
  );
  wrap.append(bg);

  const attract = el("div", "journey-attract");
  const shapeList =
    density === "light"
      ? SETUP_ATTRACT_INDICES.map((i) => JOURNEY_ATTRACT_SHAPES[i])
      : JOURNEY_ATTRACT_SHAPES;

  for (const cfg of shapeList) {
    const node = el("span", `drift-shape shape-${cfg.shape}`);
    node.style.width = `${cfg.size}px`;
    node.style.height = `${cfg.size}px`;
    node.style.top = cfg.top;
    node.style.left = cfg.left;
    node.style.animationDuration = `${cfg.duration}s`;
    node.style.animationDelay = `${cfg.delay}s`;
    attract.append(node);
  }
  wrap.append(attract);

  return wrap;
}
