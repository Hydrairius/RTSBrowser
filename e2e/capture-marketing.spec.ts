/**
 * Marketing captures → docs/marketing/
 * - npm run capture:marketing        — full-screen PNGs
 * - npm run capture:marketing:video  — tab recording with audio (headed)
 * - npm run capture:marketing:all    — both
 */
import fs from "node:fs";
import path from "node:path";
import { test, expect, chromium, type Page, type Browser } from "@playwright/test";
import {
  AI_HQ_CELL,
  assignWorkersToGenerator,
  BARRACKS_MARKETING_CELL,
  buildStructureAt,
  clearBuildMode,
  followSelectedUnitsWithCamera,
  GENERATOR_MARKETING_CELL,
  issueMapOrder,
  rallyWorkersToBuildSite,
  screenshotFullWindow,
  selectCombatTroops,
  selectHumanBarracks,
  selectSetupFaction,
  trainWorkersFromHq,
  waitForHumanStructureBuilt,
  waitForMatchDebug,
  waitForMatchIntro,
} from "./helpers/match.js";
import { startTabVideoRecording, stopTabVideoRecording } from "./helpers/tab-video.js";

const OUT_DIR = path.join(process.cwd(), "docs", "marketing");
const BARRACKS_CELL = BARRACKS_MARKETING_CELL;

const TROOP_MARCH = [
  { gx: 48, gy: 64 },
  { gx: 72, gy: 52 },
  { gx: 98, gy: 40 },
];

const VIEWPORT = { width: 1920, height: 1080 };
const VIDEO_OUT = path.join(OUT_DIR, "vertex-gameplay.webm");

test.use({
  viewport: VIEWPORT,
  deviceScaleFactor: 1,
});

async function applyMarketingChrome(page: Page): Promise<void> {
  await page.addStyleTag({
    content: `
      html, body { margin: 0 !important; overflow: hidden !important; height: 100% !important; width: 100% !important; }
      #app, #app.match-active { width: 100vw !important; height: 100vh !important; min-height: 100vh !important; max-width: none !important; }
      .screen.screen-setup { overflow: hidden !important; min-height: 100vh !important; justify-content: center !important; }
      .match-demo-bar { display: none !important; }
    `,
  });
}

async function unlockGameAudio(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const unlock = (window as unknown as { __RTS_AUDIO_UNLOCK__?: () => Promise<void> })
      .__RTS_AUDIO_UNLOCK__;
    await unlock?.();
  });
}

async function shot(page: Page, name: string): Promise<void> {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  await screenshotFullWindow(page, path.join(OUT_DIR, name));
}

async function selectFactionsOnVideo(page: Page): Promise<void> {
  const playerPanel = page.locator(".setup-panel").first();
  await playerPanel.locator(".faction-card").filter({ hasText: "Loop" }).click();
  await page.waitForTimeout(900);
  await playerPanel.locator(".faction-card").filter({ hasText: "Triad" }).click();
  await page.waitForTimeout(1100);
  await selectSetupFaction(page, "ai", "Block");
  await page.waitForTimeout(1200);
}

async function runMarketingGameplay(page: Page): Promise<void> {
  const gen = GENERATOR_MARKETING_CELL;
  const bar = BARRACKS_CELL;

  await buildStructureAt(page, "Generator", gen.gx, gen.gy);
  await waitForHumanStructureBuilt(page, "generator", gen.gx, gen.gy, 25_000);

  await trainWorkersFromHq(page, 2);
  await clearBuildMode(page);
  await page.waitForTimeout(600);

  await buildStructureAt(page, "Barracks", bar.gx, bar.gy, { w: 2, h: 1 });
  await rallyWorkersToBuildSite(page, bar.gx, bar.gy, { w: 2, h: 1 });
  await waitForHumanStructureBuilt(page, "barracks", bar.gx, bar.gy, 60_000);
  await clearBuildMode(page);
  await page.waitForTimeout(800);

  await assignWorkersToGenerator(page, gen);
  await expect(page.locator(".field-unit-gathering").first()).toBeVisible({ timeout: 12_000 });

  await selectHumanBarracks(page, BARRACKS_CELL.gx, BARRACKS_CELL.gy);
  await page.locator(".train-btn").filter({ hasText: "Striker" }).click();
  await waitForMatchDebug(page, (s) => s.unitCount >= 4, 15_000);
  await page.locator(".train-btn").filter({ hasText: "Striker" }).click();
  await waitForMatchDebug(page, (s) => s.unitCount >= 5, 12_000);
  await clearBuildMode(page);

  await selectCombatTroops(page, BARRACKS_CELL.gx, BARRACKS_CELL.gy);
  for (const cell of TROOP_MARCH) {
    await issueMapOrder(page, cell.gx, cell.gy);
    await followSelectedUnitsWithCamera(page, 5500);
  }

  await issueMapOrder(page, AI_HQ_CELL.gx + 1, AI_HQ_CELL.gy + 1, { w: 2, h: 2 });
  await followSelectedUnitsWithCamera(page, 8000);
  await page.waitForTimeout(2000);
}

test.describe("marketing screenshots", () => {
  test("full-screen PNG set", async ({ page }) => {
    test.setTimeout(300_000);
    await applyMarketingChrome(page);

    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Vertex" })).toBeVisible();
    await page.waitForTimeout(600);
    await shot(page, "01-title.png");

    await page.getByRole("button", { name: "Play" }).click();
    await unlockGameAudio(page);
    await expect(page.locator(".screen-setup")).toBeVisible();
    await selectSetupFaction(page, "player", "Triad");
    await selectSetupFaction(page, "ai", "Block");
    await page.waitForTimeout(500);
    await shot(page, "02-skirmish-setup.png");

    await page.getByRole("button", { name: "Start match" }).click();
    await expect(page.locator(".match-active")).toBeVisible({ timeout: 15_000 });
    await waitForMatchIntro(page);
    await waitForMatchDebug(page, (s) => s.simTick > 12, 15_000);
    await page.getByRole("button", { name: "⌂ Jump to your HQ" }).click();
    await page.waitForTimeout(1200);
    await shot(page, "03-match-base.png");

    await runMarketingGameplay(page);
    await shot(page, "04-match-production.png");

    await page.getByRole("button", { name: "Demo: Win" }).click({ force: true });
    await expect(page.locator(".screen-results.victory")).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(800);
    await shot(page, "05-victory.png");
  });
});

test.describe("marketing video", () => {
  test("faction pick through troop move", async () => {
    test.setTimeout(360_000);
    const headed = process.env.CAPTURE_HEADLESS !== "1";
    const browser = await chromium.launch({
      headless: !headed,
      args: [
        "--autoplay-policy=no-user-gesture-required",
        "--enable-usermedia-screen-capturing",
        "--allow-http-screen-capture",
        "--auto-select-tab-capture-source-by-title=Vertex",
      ],
    });
    try {
      await runMarketingVideo(browser, headed);
    } finally {
      await browser.close();
    }
  });
});

async function runMarketingVideo(browser: Browser, headed: boolean): Promise<void> {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
    ...(headed ? {} : { recordVideo: { dir: OUT_DIR, size: VIEWPORT } }),
  });
  const page = await context.newPage();
  await applyMarketingChrome(page);

  let usedTabCapture = false;
  try {
    await page.goto("/");
    await page.getByRole("button", { name: "Play" }).click();
    await unlockGameAudio(page);
    await expect(page.locator(".screen-setup")).toBeVisible();

    if (headed) {
      await startTabVideoRecording(page);
      usedTabCapture = true;
    }

    await selectFactionsOnVideo(page);
    await page.getByRole("button", { name: "Start match" }).click();
    await expect(page.locator(".match-active")).toBeVisible({ timeout: 15_000 });

    await waitForMatchIntro(page);
    await waitForMatchDebug(page, (s) => s.simTick > 8, 15_000);
    await runMarketingGameplay(page);
  } finally {
    if (usedTabCapture) {
      await stopTabVideoRecording(page, VIDEO_OUT);
    }
    await context.close();
  }

  if (!usedTabCapture) {
    const video = page.video();
    if (video) {
      await video.saveAs(VIDEO_OUT);
    }
    console.warn(
      "[capture:marketing:video] No tab audio capture (headless). Re-run with CAPTURE_HEADED=1 for sound.",
    );
  }

  for (const entry of fs.readdirSync(OUT_DIR)) {
    if (entry.startsWith("page@") && entry.endsWith(".webm")) {
      fs.unlinkSync(path.join(OUT_DIR, entry));
    }
  }
}
