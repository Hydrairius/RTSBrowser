import { test, expect } from "@playwright/test";
import { getMatchDebug, startSkirmish, waitForMatchIntro } from "./helpers/match.js";

test.describe("match perf debug", () => {
  test("exposes perf snapshot after sim runs", async ({ page }) => {
    await startSkirmish(page);
    await waitForMatchIntro(page);
    await page.waitForTimeout(1500);

    const snap = await getMatchDebug(page);

    expect(snap.unitCount).toBeGreaterThanOrEqual(2);
    expect(snap.perf.lastSimMs).toBeLessThan(50);
    expect(snap.perf.lastRenderMs).toBeLessThan(80);
  });
});
