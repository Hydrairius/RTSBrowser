# RTSBrowser (Vertex)

Browser-based geometric RTS prototype — local skirmish vs AI, three factions (Triad, Loop, Block).

## Play

After [GitHub Pages deployment](docs/deployment.md) is enabled:

```text
https://<your-github-username>.github.io/<repository-name>/
```

No install required; use a modern desktop browser.

## Develop locally

Requires **Node.js 22.5+**.

```powershell
npm install
Copy-Item .env.example .env
npm run dev:client   # http://localhost:5173 — v0 skirmish
npm run dev:server   # http://localhost:3001 — optional; auth / WebSocket test
```

Details: [src/README.md](src/README.md).

## Deploy

**[docs/deployment.md](docs/deployment.md)** — GitHub Pages workflow, local Pages preview, audio assets, troubleshooting.

## Repository

| Path | Purpose |
|------|---------|
| `packages/` | Client, server, shared simulation |
| `features/` | Design specs and feature tooling |
| `docs/` | Cross-cutting guides (deployment) |
| `AGENTS.md` | Agent / contributor map |

License: [MIT](LICENSE).
