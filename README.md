# Radio Calico

A web-based lossless music radio player. Streams 24-bit / 48 kHz audio via HLS, shows live track metadata, lets listeners rate songs with thumbs up/down, and fetches album art automatically.

## Features

- Live HLS audio stream with play/pause and volume control
- Real-time track metadata (artist, title, album, audio quality)
- Thumbs up/down ratings per track, persisted per visitor
- Album art lookup via MusicBrainz and Cover Art Archive
- Previous 5 tracks list
- Server-side rendering for fast initial load

## Stack

- **Backend:** Node.js + Express (ES modules)
- **Database:** PostgreSQL
- **Frontend:** Vanilla JS + [HLS.js](https://github.com/video-dev/hls.js/)

## Local Development

Requires Docker and Docker Compose.

```bash
# Development — watch mode, source volume mount, pgAdmin included
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build

# Production — no devDependencies, DB not exposed externally, no pgAdmin
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build
```

| Service  | Dev | Prod | URL |
|----------|-----|------|-----|
| App      | ✓   | ✓    | http://localhost:3000 |
| pgAdmin  | ✓   | —    | http://localhost:5050 |

pgAdmin credentials: `admin@local.dev` / `admin`

To run without Docker, set `DATABASE_URL` and then:

```bash
npm run dev   # watch mode
npm start     # production
npm test      # run all tests
```

## Project Structure

```
src/index.js          — Express server (all API routes + SSR)
src/ratings.js        — Vote processing logic
public/index.html     — HTML markup
public/style.css      — Styles
public/js/app.js      — Client-side JavaScript
public/js/utils.js    — Pure utility functions (makeSongId, esc, applyRating)
db/init.sql           — Database schema (auto-applied on first container start)
tests/                — Unit tests (node:test for backend, Vitest + jsdom for frontend)
docker-compose.yml        — Shared base (DB service)
docker-compose.dev.yml    — Dev overrides (watch mode, volume mount, pgAdmin)
docker-compose.prod.yml   — Prod overrides (no devDeps, no pgAdmin, DB internal)
```

## API

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/` | Renders the player with pre-populated track data |
| `GET` | `/api/metadata` | Current track metadata (proxied from CloudFront) |
| `GET` | `/api/ratings/:songId` | Thumbs-up/down counts and current visitor's vote |
| `POST` | `/api/ratings/:songId` | Cast or toggle a vote (`{ "vote": "up" \| "down" }`) |
| `GET` | `/health` | Database connectivity check |
