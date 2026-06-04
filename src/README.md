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
