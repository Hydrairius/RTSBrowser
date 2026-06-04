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
}

boot();
