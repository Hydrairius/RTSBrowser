import { test, expect } from "@playwright/test";
import {
  clickMapPlacementCell,
  getMatchDebug,
  selectHumanBarracks,
  selectHumanHq,
  startMatchFromSetup,
  startSkirmish,
  surrenderMatch,
  waitForHumanStructureBuilt,
  waitForMatchDebug,
  waitForMatchIntro,
} from "./helpers/match.js";

/** Human-side matter deposit used in shared unit tests (gx 30, gy 72). */
const GENERATOR_CELL = { gx: 30, gy: 72 };
/** Open pad near HQ for a 2×1 barracks. */
const BARRACKS_CELL = { gx: 28, gy: 72 };

test.describe("skirmish gameplay", () => {
  test("simulation runs with starting workers and matter", async ({ page }) => {
    await startSkirmish(page);
    await waitForMatchIntro(page);

    const snap = await waitForMatchDebug(page, (s) => s.simTick > 8, 10_000);

    expect(snap.unitCount).toBeGreaterThanOrEqual(2);
    expect(snap.matter).toBe(400);
    expect(snap.hq).toEqual({ gx: 25, gy: 70 });
  });

  test("full loop: barracks, train striker, generator income, surrender", async ({ page }) => {
    test.setTimeout(120_000);

    await startSkirmish(page, { playerFaction: "Triad", aiFaction: "Block" });
    await waitForMatchIntro(page);
    await waitForMatchDebug(page, (s) => s.simTick > 5);

    // --- Production first (starting workers build before generator pulls them) ---
    await selectHumanHq(page);
    await page.locator(".build-rail-btn").filter({ hasText: "Barracks" }).click();
    await clickMapPlacementCell(page, BARRACKS_CELL.gx, BARRACKS_CELL.gy, { w: 2, h: 1 });

    await waitForMatchDebug(page, (s) => s.matter < 400, 5_000);
    await waitForHumanStructureBuilt(page, "barracks", BARRACKS_CELL.gx, BARRACKS_CELL.gy, 25_000);

    const unitsBeforeTrain = (await getMatchDebug(page)).unitCount;
    await selectHumanBarracks(page, BARRACKS_CELL.gx, BARRACKS_CELL.gy);
    await page.locator(".train-btn").filter({ hasText: "Striker" }).click();

    await waitForMatchDebug(page, (s) => s.unitCount > unitsBeforeTrain, 12_000);

    const afterTrain = await getMatchDebug(page);

    // --- Economy: generator on a matter deposit ---
    await selectHumanHq(page);
    await page.locator(".build-rail-btn").filter({ hasText: "Generator" }).click();
    await clickMapPlacementCell(page, GENERATOR_CELL.gx, GENERATOR_CELL.gy);

    await waitForMatchDebug(page, (s) => s.matter < afterTrain.matter, 5_000);
    await waitForHumanStructureBuilt(page, "generator", GENERATOR_CELL.gx, GENERATOR_CELL.gy, 15_000);

    const afterGenerator = await getMatchDebug(page);
    await waitForMatchDebug(
      page,
      (s) => s.matter > afterGenerator.matter + 3,
      35_000,
    );

    const hudCap = page.locator(".hud-unit-cap-count");
    await expect(hudCap).not.toHaveText(/^0 \/ /);

    // --- Real match end (not demo buttons) ---
    await surrenderMatch(page);
    await expect(page.getByText("You surrendered")).toBeVisible();
  });

  test("rematch returns to a live match after surrender", async ({ page }) => {
    await startSkirmish(page);
    await waitForMatchIntro(page);
    await waitForMatchDebug(page, (s) => s.simTick > 5);

    await surrenderMatch(page);
    await page.getByRole("button", { name: "Rematch" }).click();

    await startMatchFromSetup(page);
    await waitForMatchIntro(page);

    const snap = await waitForMatchDebug(page, (s) => s.simTick > 3);
    expect(snap.matter).toBe(400);
    expect(snap.unitCount).toBeGreaterThanOrEqual(2);
  });
});
