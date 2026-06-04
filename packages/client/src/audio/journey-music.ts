import type { ScreenId } from "../navigation/types.js";
import { audio } from "./audio-service.js";

/** Screen → background music. Match intro starts `music.match` from match.ts. */
export function syncMusicForScreen(screen: ScreenId): void {
  if (!audio.isUnlocked()) return;

  switch (screen) {
    case "title":
      audio.playMusic("music.landing");
      break;
    case "settings":
    case "skirmish-setup":
      audio.playMusic("music.menu");
      break;
    case "loading":
    case "results":
      audio.stopMusic();
      break;
    case "match":
      // Menu/landing faded out on loading; match music starts after intro pan.
      audio.stopMusic();
      break;
  }
}

/** Call after the first user gesture on the title screen to unlock + start landing music. */
export function unlockAndSyncLandingMusic(): void {
  void audio.unlock().then(() => syncMusicForScreen("title"));
}
