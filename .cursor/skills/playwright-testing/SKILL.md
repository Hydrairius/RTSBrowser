---
name: playwright-testing
description: >-
  Tests RTSBrowser in the browser with Playwright MCP (interactive) or
  @playwright/test (committed e2e). Use when verifying UI, writing e2e specs,
  debugging client journeys, or when the user mentions Playwright, browser tests,
  or MCP browser tools.
---

# Playwright testing — RTSBrowser

## Prerequisites

| Requirement | Check |
|-------------|--------|
| Playwright MCP connected | Cursor **Settings → Tools & MCP** shows `playwright` green |
| Dev deps installed | Root `package.json` has `@playwright/mcp`, `@playwright/test` |
| Browsers | `npx playwright install chromium` from repo root |
| App running (e2e / MCP) | `npm run dev:server` + `npm run dev:client` |

**URLs**

| Target | URL |
|--------|-----|
| Client (Vite) | `http://localhost:5173` |
| API | `http://localhost:3001` |
| Net dev harness | `http://localhost:5173/?dev=net` |

Copy `.env.example` to `.env` before server tests if auth/DB paths matter.

---

## Choose a mode

| Goal | Tool | Output |
|------|------|--------|
| Explore UI, reproduce bug, one-off check | **Playwright MCP** | Chat report + optional screenshot |
| Repeatable CI / regression | **`@playwright/test`** | Specs under `e2e/` |

Do not mix both for the same assertion in one turn unless the user asks. Prefer MCP first when behavior is unclear; codify in `e2e/` once stable.

---

## v0 player journey (test spine)

Canonical flow from [features/ui-hud/data/screens.json](features/ui-hud/data/screens.json):

```
title → skirmish-setup → loading (~2s) → match → results
```

**Stable DOM locators today** (no `data-testid` yet — use roles/text; add testids when touching UI for tests):

| Screen | Assert with | Primary actions |
|--------|-------------|-----------------|
| Title | `heading` "RTSBrowser", `.screen-title` | `getByRole('button', { name: 'Play' })` |
| Skirmish setup | `.screen-setup`, "Skirmish setup" | Faction: `getByRole('button', { name: 'Triad' })` etc.; `Start match` (disabled until faction picked) |
| Loading | `.screen-loading`, "Preparing battlefield" | Wait for auto transition (~2s) |
| Match | `.match-active`, `.match-hud`, `.match-viewport` | Dev: `Demo: Win` / `Demo: Lose` (after ~2s intro) → results |
| Results | `.screen-results`, "VICTORY" or "DEFEAT" | `Rematch`, `Main menu` |

**Skirmish setup helper flow (e2e)**

1. Click **Play**
2. Click a player faction card (e.g. **Triad**)
3. Click **Start match**
4. Wait for loading to finish (URL still `/`, screen class changes to match)
5. On match, wait for intro fade (~2s), click **Demo: Win**
6. Assert `.screen-results` and **VICTORY**

Match viewport is mostly canvas/DOM markers — assert HUD and intro text, not pixel colors.

---

## Playwright MCP workflow

1. Confirm servers are up (or start them in a terminal).
2. Use MCP browser tools: navigate → snapshot → interact via element refs from snapshot.
3. After each major step, snapshot again and state what screen class or heading proves success.
4. On failure: note URL, visible screen class (`document.querySelector('.screen')?.className`), and last snapshot excerpt.

**Headless** (optional): project `.cursor/mcp.json` can pass `"--headless"` in `args` after `@playwright/mcp@latest`.

**Do not** enable `browser_run_code_unsafe` unless the user explicitly trusts RCE for that session.

---

## @playwright/test workflow

1. If missing, add root [playwright.config.ts](reference.md#playwrightconfigts) and `e2e/` per [reference.md](reference.md).
2. Write specs in `e2e/*.spec.ts` — one journey per file when possible.
3. Run: `npx playwright test` from repo root; UI mode: `npx playwright test --ui`.
4. On failure: read trace (`npx playwright show-report`) and fix app or locator.

**Conventions**

- `baseURL`: `http://localhost:5173`
- Prefer `getByRole`, `getByLabel`, `getByText` over CSS when labels exist.
- When adding new interactive UI, add `data-testid` on primary actions (e.g. `data-testid="play-v0"`) — keeps tests stable across restyle.
- Timeouts: loading screen needs `expect(...).toBeVisible({ timeout: 10_000 })` or `page.waitForSelector('.match-active')`.

---

## API / server checks

Client-only journey tests usually need only Vite. If testing `?dev=net` or REST:

- Server on port **3001**
- `CORS_ORIGIN=http://localhost:5173` per `.env.example`

Use `request` fixture from Playwright for API smoke, or MCP network tools for ad-hoc inspection.

---

## Report format (after a test pass)

```markdown
## Playwright test summary
- **Mode:** MCP | e2e
- **Scope:** [journey / screen / API]
- **Result:** pass | fail
- **Steps:** …
- **Failures:** … (if any)
- **Follow-ups:** missing testids, flaky timing, server not running
```

---

## Additional resources

- Config template, example spec, MCP checklist: [reference.md](reference.md)
- Screen IDs and transitions: [features/ui-hud/data/screens.json](features/ui-hud/data/screens.json)
- UX copy reference: [features/ui-hud/data/player-journey.md](features/ui-hud/data/player-journey.md)
