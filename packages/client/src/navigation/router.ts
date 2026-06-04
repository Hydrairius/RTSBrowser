import type { JourneyEvent, ScreenId } from "./types.js";

/** v0 transitions from features/ui-hud/data/screens.json */
const TRANSITIONS: Record<ScreenId, Partial<Record<JourneyEvent, ScreenId>>> = {
  title: { "play-v0": "skirmish-setup", "open-settings": "settings" },
  settings: {},
  "skirmish-setup": { "start-match": "loading", back: "title" },
  loading: { ready: "match" },
  match: { "match-ended": "results" },
  results: { rematch: "skirmish-setup", "main-menu": "title", "open-settings": "settings" },
};

export class JourneyRouter {
  #screen: ScreenId = "title";
  #returnScreen: ScreenId | null = null;
  #listeners = new Set<(screen: ScreenId) => void>();

  get screen(): ScreenId {
    return this.#screen;
  }

  subscribe(fn: (screen: ScreenId) => void): () => void {
    this.#listeners.add(fn);
    return () => this.#listeners.delete(fn);
  }

  dispatch(event: JourneyEvent): boolean {
    if (event === "open-settings") {
      const next = TRANSITIONS[this.#screen]?.[event];
      if (!next) return false;
      this.#returnScreen = this.#screen;
      this.#screen = next;
      for (const fn of this.#listeners) fn(this.#screen);
      return true;
    }

    if (this.#screen === "settings" && event === "back") {
      const next = this.#returnScreen ?? "title";
      this.#returnScreen = null;
      this.#screen = next;
      for (const fn of this.#listeners) fn(this.#screen);
      return true;
    }

    const next = TRANSITIONS[this.#screen]?.[event];
    if (!next) return false;
    this.#screen = next;
    for (const fn of this.#listeners) fn(this.#screen);
    return true;
  }
  resetTo(screen: ScreenId): void {
    this.#screen = screen;
    for (const fn of this.#listeners) fn(this.#screen);
  }
}
