# Deployment

How to publish **Vertex** (RTSBrowser v0 skirmish) so others can play in a browser without installing Node.

## What gets deployed

| Component | Deployed for public play? | Notes |
|-----------|-------------------------|--------|
| `@rtsbrowser/client` (Vite static build) | **Yes** | Title → skirmish → match; simulation runs in the browser |
| `@rtsbrowser/shared` | Built in CI, not hosted separately | Compiled to `packages/shared/dist/`; required before client `tsc` |
| `@rtsbrowser/server` | **No** (v0) | Auth + WebSocket rooms; only needed for `?dev=net` networking tests |

Output directory: `packages/client/dist/` (uploaded by GitHub Actions).

## GitHub Pages (recommended)

### First-time setup

1. Push the repository to GitHub on the **`main`** branch.
2. Open the repo → **Settings** → **Pages**.
3. Under **Build and deployment**, set **Source** to **GitHub Actions** (not “Deploy from a branch”).
4. Push to `main` or run the workflow manually (**Actions** → **Deploy to GitHub Pages** → **Run workflow**).

Workflow file: [`.github/workflows/deploy-pages.yml`](../.github/workflows/deploy-pages.yml).

**Alternative (branch-only Pages UI):** [`.github/workflows/deploy-pages-gh-pages-branch.yml`](../.github/workflows/deploy-pages-gh-pages-branch.yml) pushes the build to the **`gh-pages`** branch; set Pages source to that branch, root `/`. Do not publish **`main`** at `/` — that serves the README.

### Play URL

Project sites use the repository name as the path:

```text
https://<github-username>.github.io/<repository-name>/
```

Example: repo `RTSBrowser` → `https://mellowjohn.github.io/RTSBrowser/`

The workflow sets `VITE_BASE_PATH=/<repository-name>/` so assets and routes resolve correctly.

### What CI does

1. `npm ci` at the repo root (npm workspaces).
2. `npm run build -w @rtsbrowser/shared` — generates `dist/` and TypeScript declarations (not committed; see `.gitignore`).
3. `npm run build -w @rtsbrowser/client` — runs `prebuild` (shared again if needed), `tsc`, then `vite build` with `VITE_BASE_PATH`.
4. Uploads `packages/client/dist` to GitHub Pages.

Client build also has a local safeguard:

```json
"prebuild": "npm run build -w @rtsbrowser/shared"
```

in `packages/client/package.json`.

### Audio assets

Sounds are loaded from `packages/client/public/audio/` (paths in `features/audio/data/sfx-manifest.json`). They must exist in the repo before deploy or the game runs without SFX/music.

Generate silent placeholders for development:

```powershell
node features/audio/tools/generate-placeholders.mjs
git add packages/client/public/audio
git commit -m "Add audio placeholders for deploy"
```

The client prefixes manifest URLs with Vite’s `base` ([`packages/client/src/audio/public-url.ts`](../packages/client/src/audio/public-url.ts)) so audio works under `/RepoName/`.

## Test a Pages build locally

Use the same base path as your GitHub repo name:

```powershell
$env:VITE_BASE_PATH = "/RTSBrowser/"   # replace RTSBrowser with your repo name
npm run build -w @rtsbrowser/client
npm run preview -w @rtsbrowser/client
```

Open `http://localhost:4173/RTSBrowser/` (adjust the path to match `VITE_BASE_PATH`).

Local dev (`npm run dev:client` at `http://localhost:5173`) uses base `/` and does not need `VITE_BASE_PATH`.

## Troubleshooting

### Site shows README instead of the game

If [your Pages URL](https://hydrairius.github.io/RTSBrowser/) renders the repository **README** (headings like “Play”, “Develop locally”, tables of `packages/`), Pages is publishing the **repo root**, not the built client.

That happens when **Source** is **Deploy from a branch** → **`main`** → **`/ (root)`**. GitHub serves `README.md` from the monorepo; the game lives in `packages/client/dist` after a build.

**Fix (preferred):**

1. **Settings** → **Pages** → **Build and deployment** → **Source** → **GitHub Actions** (not Branch).
2. **Actions** → **Deploy to GitHub Pages** → **Run workflow** (wait for green).
3. Reload `https://<username>.github.io/<repo>/` — you should see the **Vertex** title screen, not markdown docs.

**Fix (if you only see “Branch” in Source):**

1. Push this repo (includes [`.github/workflows/deploy-pages-gh-pages-branch.yml`](../.github/workflows/deploy-pages-gh-pages-branch.yml)).
2. **Actions** → **Deploy dist to gh-pages branch** → wait for success (creates/updates a `gh-pages` branch with only `packages/client/dist`).
3. **Settings** → **Pages** → **Source** → **Deploy from a branch** → Branch **`gh-pages`** → Folder **`/ (root)`** — **not** `main`.
4. Reload the play URL after a minute.

Use **either** GitHub Actions source **or** `gh-pages` branch source, not `main` + root.

### `Cannot find module '@rtsbrowser/shared'`

`@rtsbrowser/shared` resolves to `packages/shared/dist/`, which is gitignored. Build shared before the client:

```powershell
npm run build -w @rtsbrowser/shared
npm run build -w @rtsbrowser/client
```

CI does both steps; a client-only build on a clean clone fails without shared.

### Blank page or 404 on GitHub Pages

- Confirm **Pages → Source** is **GitHub Actions**, not a static branch.
- Open the URL **with** the repo path: `.../RTSBrowser/`, not the domain root only.
- Check the latest **Deploy to GitHub Pages** run succeeded.

### Game loads but no sound

- Ensure `packages/client/public/audio/` is committed.
- In browser devtools → Network, verify requests go to `/RepoName/audio/...`, not `/audio/...` at the domain root.

### Workflow does not run

The workflow triggers on pushes to **`main`**. Other branches are not deployed unless you add triggers or use **workflow_dispatch**.

## Other static hosts

Same build, upload `packages/client/dist`:

| Host | Build command | Publish directory | Base path |
|------|---------------|-------------------|-----------|
| Cloudflare Pages | `npm run build -w @rtsbrowser/shared && npm run build -w @rtsbrowser/client` | `packages/client/dist` | Set `VITE_BASE_PATH` to your site path, or `/` for apex domain |
| Netlify / Vercel | Same | `packages/client/dist` | Configure in host UI or env |

Node **22+** for install and build ([`package.json`](../package.json) `engines`).

## Server deployment (future)

When multiplayer or accounts ship, deploy `@rtsbrowser/server` separately:

- Set `JWT_SECRET`, `PORT`, `DATABASE_PATH`, `CORS_ORIGIN` (see [`.env.example`](../.env.example)).
- Point the client API/WebSocket proxy at the server origin, or serve the built client from Express on the same host.

See [features/multiplayer/data/client-server-split.md](../features/multiplayer/data/client-server-split.md).

## Related docs

- [src/README.md](../src/README.md) — local development
- [features/game-vision/data/prototype-v0.md](../features/game-vision/data/prototype-v0.md) — v0 scope
