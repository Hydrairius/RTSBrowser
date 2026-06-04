import { audio } from "./audio/audio-service.js";
import { createApp } from "./app.js";
import { bootNetTest } from "./dev/net-test.js";

const params = new URLSearchParams(window.location.search);

async function boot(): Promise<void> {
  const app = document.getElementById("app");
  if (!app) throw new Error("#app not found");

  if (params.get("dev") === "net") {
    await bootNetTest();
    return;
  }

  createApp(app);

  if (import.meta.env.DEV) {
    (window as unknown as { __RTS_AUDIO_UNLOCK__?: () => Promise<void> }).__RTS_AUDIO_UNLOCK__ =
      () => audio.unlock();
  }
}

boot();
