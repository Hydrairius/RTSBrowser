import { syncMusicForScreen } from "./audio/journey-music.js";
import { JourneyRouter } from "./navigation/router.js";
import type { FactionId } from "./data/factions.js";
import { mountLoading } from "./screens/loading.js";
import { mountMatch, type MatchSession } from "./screens/match.js";
import { mountResults } from "./screens/results.js";
import { mountSkirmishSetup } from "./screens/skirmish-setup.js";
import { mountSettings } from "./screens/settings.js";
import { mountTitle } from "./screens/title.js";
import {
  cloneConfig,
  defaultSkirmishConfig,
  type MatchResult,
  type SkirmishConfig,
} from "./state/skirmish-config.js";

export function createApp(shell: HTMLElement): void {
  const router = new JourneyRouter();
  let config = defaultSkirmishConfig();
  let aiFaction: FactionId = "loop";
  let matchResult: MatchResult | null = null;
  let matchSession: MatchSession | null = null;
  let unmountMatch: (() => void) | null = null;

  const render = (screen: typeof router.screen) => {
    unmountMatch?.();
    unmountMatch = null;

    switch (screen) {
      case "title":
        mountTitle(shell, router);
        break;
      case "settings":
        mountSettings(shell, router);
        break;
      case "skirmish-setup":
        mountSkirmishSetup(shell, router, {
          getConfig: () => config,
          setConfig: (c) => {
            config = c;
          },
        });
        break;
      case "loading":
        mountLoading(shell, router, config, ({ aiFaction: ai }) => {
          aiFaction = ai;
          matchSession = {
            config: cloneConfig(config),
            aiFaction: ai,
            startedAt: Date.now(),
          };
        });
        break;
      case "match":
        if (!matchSession) {
          matchSession = {
            config: cloneConfig(config),
            aiFaction,
            startedAt: Date.now(),
          };
        }
        unmountMatch = mountMatch(shell, router, matchSession, (payload) => {
          matchResult = {
            outcome: payload.outcome,
            reason: payload.reason,
            durationSec: payload.durationSec,
          };
        });
        break;
      case "results":
        mountResults(shell, router, config, matchResult ?? {
          outcome: "victory",
          reason: "Enemy HQ destroyed",
          durationSec: 0,
        });
        break;
    }
  };

  const applyScreen = (screen: typeof router.screen) => {
    render(screen);
    syncMusicForScreen(screen);
  };

  router.subscribe((screen) => {
    if (screen === "title") {
      config = defaultSkirmishConfig();
      matchResult = null;
      matchSession = null;
    }
    if (screen === "skirmish-setup") {
      matchResult = null;
      matchSession = null;
    }
    applyScreen(screen);
  });

  applyScreen(router.screen);
}
