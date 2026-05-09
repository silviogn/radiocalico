# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Team

- **Principal Engineer:** Silvio Normey Gómez

## Stack

- **Web server:** Node.js + Express (`"type": "module"` — ES modules throughout)
- **Database:** PostgreSQL — used in both development and production
- **Frontend:** Vanilla JS + HLS.js in a single `index.html`

## Local Development

Docker Compose at project root with three services:

| Service | Port |
|---|---|
| Express | 3000 |
| PostgreSQL | 5432 |
| pgAdmin | 5050 |

```bash
docker compose up --build
```

Run without Docker (requires a local Postgres instance with `DATABASE_URL` set):

```bash
npm run dev   # watch mode
npm start     # production
```

No linting, formatting, or test tooling is configured.

## Architecture

```
src/index.js          — Express server (single file, all routes)
public/index.html     — HTML markup (served via SSR)
public/style.css      — All styles
public/js/app.js      — All client-side JavaScript
db/init.sql           — Schema; auto-runs on first Postgres container start
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

`public/index.html` is pure markup. On load, `public/js/app.js` reads `window.__INIT__` (injected by the server at SSR time) for the initial track, then polls `/api/metadata` every 15 seconds. Album art is fetched from the Cover Art Archive API. HLS streaming uses HLS.js with native fallback for Safari/iOS.

The `songId` derivation logic is duplicated between `src/index.js` (`songId()`) and `public/js/app.js` (`makeSongId()`) — keep them in sync when changing the format.


# Style Guide 
- A text version of the styling guide for the webpage is RadioCalico_Style_Guide.txt
- The Radio Calico logo is RadioCalicoLogoTM.png