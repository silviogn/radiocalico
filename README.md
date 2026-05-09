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
docker compose up --build
```

| Service  | URL                         |
|----------|-----------------------------|
| App      | http://localhost:3000       |
| pgAdmin  | http://localhost:5050       |

pgAdmin credentials: `admin@local.dev` / `admin`

To run without Docker, set `DATABASE_URL` and then:

```bash
npm run dev   # watch mode
npm start     # production
```

## Project Structure

```
src/index.js          — Express server (all API routes + SSR)
public/index.html     — HTML markup
public/style.css      — Styles
public/js/app.js      — Client-side JavaScript
db/init.sql           — Database schema (auto-applied on first container start)
```

## API

| Method | Route | Description |
|--------|-------|-------------|
| `GET` | `/` | Renders the player with pre-populated track data |
| `GET` | `/api/metadata` | Current track metadata (proxied from CloudFront) |
| `GET` | `/api/ratings/:songId` | Thumbs-up/down counts and current visitor's vote |
| `POST` | `/api/ratings/:songId` | Cast or toggle a vote (`{ "vote": "up" \| "down" }`) |
| `GET` | `/health` | Database connectivity check |
