import { test, expect } from "@playwright/test";
import {
  startSkirmish,
  surrenderMatch,
  waitForMatchIntro,
} from "./helpers/match.js";

test.describe("v0 skirmish journey", () => {
  test("reaches match HUD", async ({ page }) => {
    await startSkirmish(page);
  });

  test("surrender shows defeat results", async ({ page }) => {
    await startSkirmish(page);
    await waitForMatchIntro(page);
    await surrenderMatch(page);
    await expect(page.getByText("You surrendered")).toBeVisible();
  });

  test("main menu returns to title", async ({ page }) => {
    await startSkirmish(page);
    await waitForMatchIntro(page);
    await surrenderMatch(page);
    await expect(page.locator(".screen-results")).toBeVisible();

    await page.getByRole("button", { name: "Main menu" }).click();

    await expect(page.getByRole("heading", { name: "Vertex" })).toBeVisible();
    await expect(page.locator(".screen-title")).toBeVisible();
  });
});
