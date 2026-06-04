# Application source

Implementation lives in **`packages/`** (npm workspaces):

| Package | Role |
|---------|------|
| `@rtsbrowser/shared` | Protocol types + deterministic test simulation |
| `@rtsbrowser/server` | Auth API (email/password), WebSocket game rooms |
| `@rtsbrowser/client` | Vite UI for register/login + networking test |

## Requirements

- **Node.js 22.5+** (uses built-in `node:sqlite` — no native `better-sqlite3` rebuild)

## Run locally

```powershell
npm install
Copy-Item .env.example .env
npm run dev:server   # http://localhost:3001
npm run dev:client   # http://localhost:5173
```

If the server fails with **port 3001 already in use**, a previous dev server is still running:

```powershell
npm run kill:server
npm run dev:server
```

The `SQLite is an experimental feature` message is a Node warning and is safe to ignore.

See [features/multiplayer/data/client-server-split.md](../features/multiplayer/data/client-server-split.md) for what runs on client vs server.

## Play online (GitHub Pages)

The workflow [`.github/workflows/deploy-pages.yml`](../.github/workflows/deploy-pages.yml) builds the client and publishes to GitHub Pages on every push to `main`.

1. Push this repo to GitHub (repo name becomes the URL path, e.g. `RTSBrowser` → `/RTSBrowser/`).
2. On GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. After the workflow succeeds, open `https://<user>.github.io/<repo>/`.

v0 skirmish runs entirely in the browser; no server is required to play.

**Test the Pages build locally:**

```powershell
$env:VITE_BASE_PATH = "/RTSBrowser/"   # use your GitHub repo name
npm run build -w @rtsbrowser/client
npm run preview -w @rtsbrowser/client
# http://localhost:4173/RTSBrowser/
```
