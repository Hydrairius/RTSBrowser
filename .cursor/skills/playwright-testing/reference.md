# Playwright reference — RTSBrowser

## playwright.config.ts

Create at repo root if missing:

```typescript
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:5173",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "npm run dev:server",
      url: "http://localhost:3001/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "npm run dev:client",
      url: "http://localhost:5173",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
```

Server probe: `http://localhost:3001/api/health`. Drop `webServer` and start dev manually if CI cannot spawn both processes.

---

## Example e2e spec

`e2e/v0-journey.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test("v0 skirmish journey reaches match HUD", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "RTSBrowser" })).toBeVisible();
  await page.getByRole("button", { name: "Play" }).click();

  await expect(page.locator(".screen-setup")).toBeVisible();
  await page.getByRole("button", { name: "Triad" }).first().click();
  await page.getByRole("button", { name: "Start match" }).click();

  await expect(page.locator(".match-active")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".match-hud")).toBeVisible();
});
```

Optional extension — end match via demo controls (wait for intro first):

```typescript
await page.waitForTimeout(2500);
await page.getByRole("button", { name: "Demo: Win" }).click();
await expect(page.locator(".screen-results")).toBeVisible();
await expect(page.getByRole("heading", { name: "VICTORY" })).toBeVisible();
```

---

## package.json scripts (optional)

```json
"test:e2e": "playwright test",
"test:e2e:ui": "playwright test --ui"
```

---

## MCP quick checklist

```
- [ ] playwright MCP green in Cursor
- [ ] npm run dev:server (3001)
- [ ] npm run dev:client (5173)
- [ ] browser_navigate → http://localhost:5173
- [ ] snapshot → click Play → snapshot → pick faction → Start match
- [ ] wait for .match-active or match-hud in snapshot
```

---

## Adding stable selectors

When implementing or fixing UI for tests, prefer:

```typescript
// packages/client/src/ui/dom.ts — extend button() or call sites
button("Play", "btn-primary btn-lg", { testId: "play-v0" });
```

```html
<button data-testid="play-v0" class="btn-primary btn-lg">Play</button>
```

Locator: `page.getByTestId("play-v0")`.

Screen wrappers: `data-screen="title"` on `.screen` sections helps assert routing without parsing all copy.

---

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| MCP tools missing | Reload Cursor; check `.cursor/mcp.json` |
| `Executable doesn't exist` | `npx playwright install chromium` |
| Connection refused on 5173/3001 | Start dev scripts; check ports |
| Start match disabled | Select a player faction first |
| Loading never finishes | Wait ≥3s; check console for JS errors |
| Flaky match transition | Increase timeout; wait for `.match-active` not fixed delay |
