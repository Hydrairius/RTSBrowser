---
name: dev-debug-api
description: >-
  Read live RTSBrowser dev state from the server debug API and the in-browser
  match debug hook. Use when debugging match/map/build issues, verifying sim
  ticks, or when the user asks for live dev data, debug snapshot, or API skills.
---

# Dev debug API — RTSBrowser

## Prerequisites

| Requirement | Command |
|-------------|---------|
| Server running | `npm run dev:server` → `http://localhost:3001` |
| Client running (match debug) | `npm run dev:client` → `http://localhost:5173` |

Dev HTTP endpoints are **off in production** unless `ENABLE_DEV_API=1`. They are **on** when `NODE_ENV` is not `production` (default for `npm run dev:server`).

Vite proxies `/api` to port 3001, so curl can use either host:

- `http://localhost:3001/api/...` (direct)
- `http://localhost:5173/api/...` (via proxy)

---

## Server — live snapshot

### Full dev state

```powershell
curl -s http://localhost:3001/api/dev/snapshot | ConvertFrom-Json | ConvertTo-Json -Depth 6
```

Returns:

| Field | Meaning |
|-------|---------|
| `uptimeSec` | Server uptime |
| `userCount` | Registered users in SQLite |
| `rooms[]` | Active game rooms (tick, players, positions) |

### Single room

```powershell
curl -s http://localhost:3001/api/dev/rooms/ROOM_ID_HERE
```

Replace `ROOM_ID_HERE` with `rooms[].id` from the snapshot (only exists after someone joins via `?dev=net` WebSocket).

### Health check

```powershell
curl -s http://localhost:3001/api/health
```

---

## Client — match screen (local skirmish)

While a **match** is mounted, the client exposes a console hook (dev builds only):

```javascript
__RTS_MATCH_DEBUG__()
```

In browser DevTools → Console, after starting a skirmish:

```javascript
copy(JSON.stringify(__RTS_MATCH_DEBUG__(), null, 2))
```

Returns:

| Field | Meaning |
|-------|---------|
| `camera` | Pan offset `{ x, y }` — should change when WASD/dragging |
| `viewport` | Viewport size in px |
| `hq` | HQ grid cell `{ gx, gy }` |
| `selectedBuild` | `"generator"` / `"barracks"` / `null` |
| `snapCell` | Grid cell under cursor for placement |
| `structures` | All placed structures and build progress |
| `unitCount` | Live units on the map |
| `projectileCount` | In-flight ranged shots |
| `simTick` | Current skirmish simulation tick |
| `perf.lastSimMs` | Last `advanceSkirmishTick` duration (ms) |
| `perf.lastRenderMs` | Last DOM sync after tick (ms) |
| `perf.avgSimMs` / `perf.avgRenderMs` | Rolling averages since match start |
| `perf.simFps` | Approximate sim rate from avg sim ms |

**If movement feels laggy but `perf.lastSimMs` is low (<5ms)** — display/render issue (interpolation), not sim CPU.  
**If `perf.lastRenderMs` is high (>16ms) with many units** — check `unitCount`; minimap/DOM churn.  
**If `unitCount` climbs into hundreds** — AI spam-training; see `AI_TRAIN_INTERVAL_TICKS` in shared production module.

**If `camera` stays `{0,0}` while panning** — camera/focus bug.  
**If `hq` is set but structures empty** — render bug.  
**If `selectedBuild` is set but blueprint invisible** — check cursor is over the map viewport.

---

## Agent workflow

1. Confirm server: `curl http://localhost:3001/api/health`
2. For net harness rooms: `curl http://localhost:3001/api/dev/snapshot`
3. For skirmish UI: ask user to run `__RTS_MATCH_DEBUG__()` or use Playwright `page.evaluate(() => window.__RTS_MATCH_DEBUG__?.())` on the match route
4. Compare `hq` position with `camera` — HQ should be near viewport center after **Home** or match start

---

## Related

- [playwright-testing skill](../playwright-testing/SKILL.md) — browser automation
- [features/multiplayer/data/client-server-split.md](../../features/multiplayer/data/client-server-split.md)
