# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Team

- **Principal Engineer:** Silvio Normey Gómez

## Stack

- **Web server:** Node.js + Express (`"type": "module"` — ES modules throughout)
- **Database:** PostgreSQL — used in both development and production
- **Frontend:** Vanilla JS + HLS.js (`public/js/`)

## Local Development

Three Docker Compose files: `docker-compose.yml` (shared base), `docker-compose.dev.yml` (dev overrides), `docker-compose.prod.yml` (prod overrides).

| Service | Port | Dev | Prod |
|---|---|---|---|
| Express | 3000 | ✓ | ✓ |
| PostgreSQL | 5432 | ✓ (exposed) | ✓ (internal only) |
| pgAdmin | 5050 | ✓ | — |

```bash
# Development — watch mode, source volume mount, pgAdmin
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

# Production — no devDependencies, no pgAdmin, DB not exposed
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build
```

Run without Docker (requires a local Postgres instance with `DATABASE_URL` set):

```bash
npm run dev   # watch mode
npm start     # production
```

```bash
npm test            # run all tests
npm run test:backend   # node:test (no DB needed)
npm run test:frontend  # Vitest + jsdom
```

## Architecture

```
src/index.js          — Express server (single file, all routes)
src/ratings.js        — processVote() business logic (used by route + tests)
public/index.html     — HTML markup (served via SSR)
public/style.css      — All styles
public/js/app.js      — Client-side JavaScript (DOM wiring, HLS, metadata polling)
public/js/utils.js    — Pure functions: makeSongId, esc, applyRating (imported by app.js + tests)
db/init.sql           — Schema; auto-runs on first Postgres container start
tests/ratings.test.js       — Backend tests (node:test, stub DB client)
tests/public/utils.test.js  — Frontend tests (Vitest + jsdom)
```

### Backend (`src/index.js`)

Connects to Postgres via `DATABASE_URL` using a `pg` pool. All routes are in one file:

| Route | Purpose |
|---|---|
| `GET /` | SSR: serves `public/index.html` with `window.__INIT__` pre-populated |
| `GET /api/metadata` | Proxies `metadatav2.json` from CloudFront |
| `GET /api/ratings/:songId` | Returns thumbs-up/down counts |
| `POST /api/ratings/:songId` | Casts or toggles a vote |
| `GET /health` | DB connectivity check |

`express.static` serves the project root (including `public/`), so `/public/style.css` and `/public/js/app.js` resolve without any extra route. Visitor identity is tracked via an `rc_visitor` cookie (UUID, 1-year expiry, set server-side). The `songId` key is `"artist::title"` lowercased and trimmed.

### Database (`db/init.sql`)

Three tables:
- `ratings(song_id PK, thumbs_up, thumbs_down)` — aggregated counts
- `user_ratings(visitor_id, song_id, vote CHECK('up','down'), PRIMARY KEY(visitor_id, song_id))` — per-visitor votes
- `example(id, name, created_at)` — unused placeholder

No migration framework; schema changes require editing `init.sql` and rebuilding the container (or running SQL manually against the live DB).

### Frontend (`public/`)

`public/index.html` is pure markup. On load, `public/js/app.js` (loaded as `type="module"`) imports pure utilities from `public/js/utils.js`, reads `window.__INIT__` (injected by the server at SSR time) for the initial track, then polls `/api/metadata` every 15 seconds. Album art is fetched from the Cover Art Archive API. HLS streaming uses HLS.js with native fallback for Safari/iOS.


# Style Guide 
- A text version of the styling guide for the webpage is RadioCalico_Style_Guide.txt
- The Radio Calico logo is RadioCalicoLogoTM.png