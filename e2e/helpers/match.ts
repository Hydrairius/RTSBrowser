import { expect, type Page } from "@playwright/test";

/** Mirrors packages/client/src/dev/match-debug.ts */
export interface MatchDebugSnapshot {
  simTick: number;
  unitCount: number;
  matter: number;
  hq: { gx: number; gy: number } | null;
  structures: { defId: string; ownerId: string; gx: number; gy: number; progress: number }[];
  selectedBuild: string | null;
  perf: {
    lastSimMs: number;
    lastRenderMs: number;
    avgSimMs: number;
    avgRenderMs: number;
    simFps: number;
  };
}

const HUMAN_PLAYER_ID = "human";
const CELL_PX = 48;

export interface SkirmishStartOptions {
  playerFaction?: "Triad" | "Loop" | "Block";
  aiFaction?: "Triad" | "Loop" | "Block";
}

async function selectSetupFaction(
  page: Page,
  section: "player" | "ai",
  faction: string,
): Promise<void> {
  const panel = page.locator(".setup-panel").nth(section === "player" ? 0 : 1);
  const card = panel.locator(".faction-card").filter({ hasText: faction }).first();
  await expect(card).toBeVisible();
  const selected = await card.evaluate((el) => el.classList.contains("selected"));
  if (!selected) {
    await card.click({ force: true });
  }
}

/** Start another match from skirmish setup (e.g. after Rematch). */
export async function startMatchFromSetup(page: Page): Promise<void> {
  await expect(page.locator(".screen-setup")).toBeVisible();
  await page.getByRole("button", { name: "Start match" }).click();
  await expect(page.locator(".match-active")).toBeVisible({ timeout: 15_000 });
}

export async function startSkirmish(
  page: Page,
  options: SkirmishStartOptions = {},
): Promise<void> {
  const { playerFaction = "Triad", aiFaction = "Block" } = options;

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Vertex" })).toBeVisible();
  await page.getByRole("button", { name: "Play" }).click();

  await expect(page.locator(".screen-setup")).toBeVisible();
  await selectSetupFaction(page, "player", playerFaction);
  await selectSetupFaction(page, "ai", aiFaction);
  await page.getByRole("button", { name: "Start match" }).click();

  await expect(page.locator(".match-active")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".match-hud")).toBeVisible();
}

/** Demo win/lose are ignored until the ~2.2s match intro finishes. */
export async function waitForMatchIntro(page: Page): Promise<void> {
  await expect(page.locator(".match-intro")).toHaveClass(/fade-out/, { timeout: 8_000 });
}

export async function getMatchDebug(page: Page): Promise<MatchDebugSnapshot> {
  const snap = await page.evaluate(() => {
    const fn = (window as unknown as { __RTS_MATCH_DEBUG__?: () => MatchDebugSnapshot })
      .__RTS_MATCH_DEBUG__;
    return fn?.() ?? null;
  });
  expect(snap, "__RTS_MATCH_DEBUG__ should be available in dev builds").not.toBeNull();
  return snap!;
}

export async function waitForMatchDebug(
  page: Page,
  predicate: (snap: MatchDebugSnapshot) => boolean,
  timeoutMs = 20_000,
): Promise<MatchDebugSnapshot> {
  const deadline = Date.now() + timeoutMs;
  let last = await getMatchDebug(page);
  while (!predicate(last)) {
    if (Date.now() >= deadline) {
      throw new Error(`waitForMatchDebug timed out after ${timeoutMs}ms (last: ${JSON.stringify(last)})`);
    }
    await page.waitForTimeout(200);
    last = await getMatchDebug(page);
  }
  return last;
}

export function humanStructureAt(
  snap: MatchDebugSnapshot,
  defId: string,
  gx: number,
  gy: number,
): MatchDebugSnapshot["structures"][number] | undefined {
  return snap.structures.find(
    (st) =>
      st.ownerId === HUMAN_PLAYER_ID &&
      st.defId === defId &&
      st.gx === gx &&
      st.gy === gy,
  );
}

export async function waitForHumanStructureBuilt(
  page: Page,
  defId: string,
  gx: number,
  gy: number,
  timeoutMs = 20_000,
): Promise<MatchDebugSnapshot> {
  return waitForMatchDebug(
    page,
    (s) => (humanStructureAt(s, defId, gx, gy)?.progress ?? 0) >= 1,
    timeoutMs,
  );
}

/** Click a build-placement anchor on the map (accounts for structure footprint snapping). */
export async function clickMapPlacementCell(
  page: Page,
  gx: number,
  gy: number,
  footprint: { w: number; h: number } = { w: 1, h: 1 },
): Promise<void> {
  const viewport = page.locator(".match-viewport");
  await expect(viewport).toBeVisible();
  const fw = footprint.w * CELL_PX;
  const fh = footprint.h * CELL_PX;
  const coords = await page.evaluate(
    ({ worldX, worldY }) => {
      const worldEl = document.querySelector(".match-world") as HTMLElement | null;
      if (!worldEl) return null;
      const rect = worldEl.getBoundingClientRect();
      const scaleX = worldEl.offsetWidth / rect.width;
      const scaleY = worldEl.offsetHeight / rect.height;
      return {
        x: rect.left + worldX / scaleX,
        y: rect.top + worldY / scaleY,
      };
    },
    {
      worldX: gx * CELL_PX + fw / 2 + 1,
      worldY: gy * CELL_PX + fh / 2 + 1,
    },
  );
  expect(coords, "match world layer should be mounted").not.toBeNull();
  await page.mouse.click(coords!.x, coords!.y);
}

export async function clearBuildMode(page: Page): Promise<void> {
  const active = page.locator(".build-rail-btn-active");
  if ((await active.count()) > 0) {
    await active.click();
  }
}

export async function selectHumanBarracks(
  page: Page,
  gx: number,
  gy: number,
): Promise<void> {
  await clearBuildMode(page);
  await clickMapPlacementCell(page, gx, gy, { w: 2, h: 1 });
  await expect(page.locator(".match-train-rail:not(.hidden)")).toBeVisible({ timeout: 5_000 });
}

export async function selectHumanHq(page: Page): Promise<void> {
  await page.getByRole("button", { name: "⌂ Jump to your HQ" }).click();
  await page.locator(".field-structure.structure-hq").first().click();
  await expect(page.locator(".build-rail-build-section:not(.hidden)")).toBeVisible();
}

export async function surrenderMatch(page: Page): Promise<void> {
  await page.locator(".hud-menu-btn").click();
  await expect(page.locator(".pause-overlay:not(.hidden)")).toBeVisible();
  await page.getByRole("button", { name: "Surrender" }).click();
  await expect(page.locator(".screen-results.defeat")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("heading", { name: "DEFEAT" })).toBeVisible();
}
