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

/** Matter deposit used in e2e gameplay tests. */
export const GENERATOR_CELL = { gx: 30, gy: 72 };
/** Marketing layout: east deposit + north-west pad (far apart). */
export const GENERATOR_MARKETING_CELL = { gx: 38, gy: 68 };
export const BARRACKS_MARKETING_CELL = { gx: 20, gy: 62 };
/** Block AI HQ spawn (east). */
export const AI_HQ_CELL = { gx: 135, gy: 25 };

export interface SkirmishStartOptions {
  playerFaction?: "Triad" | "Loop" | "Block";
  aiFaction?: "Triad" | "Loop" | "Block";
}

export async function selectSetupFaction(
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
  await page.evaluate(() => {
    document.querySelector(".match-world")?.classList.remove("is-building");
  });
}

/** Pick a structure from HQ build rail, place once, then exit build mode. */
export async function buildStructureAt(
  page: Page,
  label: "Generator" | "Barracks",
  gx: number,
  gy: number,
  footprint: { w: number; h: number } = { w: 1, h: 1 },
): Promise<void> {
  await selectHumanHq(page);
  await page.locator(".build-rail-btn").filter({ hasText: label }).click();
  await clickMapPlacementCell(page, gx, gy, footprint);
  await clearBuildMode(page);
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

/** Full window capture (1920×1080 viewport, includes page background). */
export async function screenshotFullWindow(page: Page, filePath: string): Promise<void> {
  await page.screenshot({
    path: filePath,
    fullPage: true,
    type: "png",
    animations: "disabled",
  });
}

/** Right-click a map cell to issue move / rally (viewport coordinates). */
export async function rightClickMapPlacementCell(
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
  await page.mouse.click(coords!.x, coords!.y, { button: "right" });
}

/** Drag-select troops inside the match viewport (offsets from viewport top-left). */
export async function dragSelectInViewport(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
): Promise<void> {
  const viewport = page.locator(".match-viewport");
  const box = await viewport.boundingBox();
  expect(box, "match viewport should have layout").not.toBeNull();
  const x0 = box!.x + from.x;
  const y0 = box!.y + from.y;
  const x1 = box!.x + to.x;
  const y1 = box!.y + to.y;
  await page.mouse.move(x0, y0);
  await page.mouse.down({ button: "left" });
  await page.mouse.move(x1, y1, { steps: 14 });
  await page.mouse.up({ button: "left" });
}

/** Center the map camera on a grid cell (dev hook). */
export async function focusCameraOnCell(page: Page, gx: number, gy: number): Promise<void> {
  await page.evaluate(({ gx, gy }) => {
    const fn = (window as unknown as { __RTS_FOCUS_CELL__?: (x: number, y: number) => void })
      .__RTS_FOCUS_CELL__;
    fn?.(gx, gy);
  }, { gx, gy });
  await page.waitForTimeout(350);
}

/** Average world position of selected (or human combat) units from DOM transforms. */
export async function humanCombatCentroidWorld(
  page: Page,
): Promise<{ x: number; y: number } | null> {
  return page.evaluate(() => {
    const parse = (el: Element) => {
      const t = (el as HTMLElement).style.transform;
      const m = /translate3d\(([-\d.]+)px,\s*([-\d.]+)px/.exec(t);
      if (!m) return null;
      return { x: Number(m[1]) + 5, y: Number(m[2]) + 5 };
    };
    let roots = [...document.querySelectorAll(".field-unit-selected:not(.field-unit-enemy)")];
    if (roots.length === 0) {
      roots = [
        ...document.querySelectorAll(
          ".field-unit:not(.field-unit-enemy):is(:has(.field-unit-glyph--striker), :has(.field-unit-glyph--bolter))",
        ),
      ];
    }
    const pts = roots.map(parse).filter((p): p is { x: number; y: number } => p !== null);
    if (pts.length === 0) return null;
    const x = pts.reduce((s, p) => s + p.x, 0) / pts.length;
    const y = pts.reduce((s, p) => s + p.y, 0) / pts.length;
    return { x, y };
  });
}

/** Keep the camera centered on moving troops for a few seconds. */
export async function followTroopsWithCamera(page: Page, durationMs: number): Promise<void> {
  const end = Date.now() + durationMs;
  while (Date.now() < end) {
    const center = await humanCombatCentroidWorld(page);
    if (center) {
      const gx = Math.floor(center.x / CELL_PX);
      const gy = Math.floor(center.y / CELL_PX);
      await focusCameraOnCell(page, gx, gy);
    }
    await page.waitForTimeout(450);
  }
}

/** Select human workers via drag box (viewport-local coordinates). */
export async function selectHumanWorkers(page: Page): Promise<void> {
  await page.getByRole("button", { name: "⌂ Jump to your HQ" }).click();
  await page.waitForTimeout(500);
  await dragSelectInViewport(page, { x: 380, y: 320 }, { x: 720, y: 520 });
  await page.waitForTimeout(300);
}

/** Train workers from HQ (must have HQ build rail visible). */
export async function trainWorkersFromHq(page: Page, count: number): Promise<void> {
  await selectHumanHq(page);
  const workerBtn = page.locator(".build-rail-btn-worker");
  for (let i = 0; i < count; i++) {
    await workerBtn.click();
    await page.waitForTimeout(700);
  }
}

/**
 * Move workers toward an incomplete structure so they pick up construct orders.
 * Uses a rally cell beside the footprint (not on the generator deposit).
 */
export async function rallyWorkersToBuildSite(
  page: Page,
  footprintGx: number,
  footprintGy: number,
  footprint: { w: number; h: number } = { w: 2, h: 1 },
): Promise<void> {
  await clearBuildMode(page);
  await focusCameraOnCell(page, footprintGx, footprintGy);
  await selectHumanWorkers(page);
  const rallyGx = footprintGx - 1;
  const rallyGy = footprintGy + footprint.h + 1;
  await issueMapOrder(page, rallyGx, rallyGy);
  await page.waitForTimeout(2500);
}

/** Send workers to mine at a generator (build mode must be off). */
export async function assignWorkersToGenerator(
  page: Page,
  generator: { gx: number; gy: number } = GENERATOR_CELL,
): Promise<void> {
  await clearBuildMode(page);
  await focusCameraOnCell(page, generator.gx, generator.gy);
  await page.waitForTimeout(400);
  await selectHumanWorkers(page);
  await issueMapOrder(page, generator.gx, generator.gy);
  await page.waitForTimeout(4000);
}


/** Box-select human combat units near the barracks pad. */
export async function selectCombatTroops(
  page: Page,
  barracksGx: number,
  barracksGy: number,
): Promise<void> {
  await clearBuildMode(page);
  await focusCameraOnCell(page, barracksGx, barracksGy);
  await page.waitForTimeout(400);
  await dragSelectInViewport(page, { x: 420, y: 280 }, { x: 880, y: 620 });
  await page.waitForTimeout(300);
}

/** Right-click attack/move; clears build mode first so we never place structures. */
export async function issueMapOrder(
  page: Page,
  gx: number,
  gy: number,
  footprint: { w: number; h: number } = { w: 1, h: 1 },
): Promise<void> {
  await clearBuildMode(page);
  await rightClickMapPlacementCell(page, gx, gy, footprint);
}

/** Pan camera to keep selected friendly units in view while they travel. */
export async function followSelectedUnitsWithCamera(
  page: Page,
  durationMs: number,
): Promise<void> {
  const end = Date.now() + durationMs;
  while (Date.now() < end) {
    const center = await page.evaluate(() => {
      const parse = (el: Element) => {
        const t = (el as HTMLElement).style.transform;
        const m = /translate3d\(([-\d.]+)px,\s*([-\d.]+)px/.exec(t);
        if (!m) return null;
        return { x: Number(m[1]) + 5, y: Number(m[2]) + 5 };
      };
      const roots = [...document.querySelectorAll(".field-unit-selected:not(.field-unit-enemy)")];
      const pts = roots.map(parse).filter((p): p is { x: number; y: number } => p !== null);
      if (pts.length === 0) return null;
      return {
        x: pts.reduce((s, p) => s + p.x, 0) / pts.length,
        y: pts.reduce((s, p) => s + p.y, 0) / pts.length,
      };
    });
    if (center) {
      await focusCameraOnCell(page, Math.floor(center.x / CELL_PX), Math.floor(center.y / CELL_PX));
    }
    await page.waitForTimeout(450);
  }
}

/** Middle-mouse pan for a short camera move (marketing video). */
export async function panMatchViewport(
  page: Page,
  delta: { dx: number; dy: number },
): Promise<void> {
  const viewport = page.locator(".match-viewport");
  const box = await viewport.boundingBox();
  expect(box, "match viewport should have layout").not.toBeNull();
  const cx = box!.x + box!.width * 0.55;
  const cy = box!.y + box!.height * 0.5;
  await page.mouse.move(cx, cy);
  await page.mouse.down({ button: "middle" });
  await page.mouse.move(cx + delta.dx, cy + delta.dy, { steps: 10 });
  await page.mouse.up({ button: "middle" });
}

export async function surrenderMatch(page: Page): Promise<void> {
  await page.locator(".hud-menu-btn").click();
  await expect(page.locator(".pause-overlay:not(.hidden)")).toBeVisible();
  await page.getByRole("button", { name: "Surrender" }).click();
  await expect(page.locator(".screen-results.defeat")).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole("heading", { name: "DEFEAT" })).toBeVisible();
}
