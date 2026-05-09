import express from 'express';
import pg from 'pg';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';
import { randomUUID } from 'crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const port = 3000;

const METADATA_URL = 'https://d3d4yli4hf5bmh.cloudfront.net/metadatav2.json';
const COOKIE_NAME  = 'rc_visitor';
const COOKIE_MAX_AGE = 365 * 24 * 60 * 60 * 1000; // 1 year

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

app.use(express.json());
app.use(express.static(join(__dirname, '..'), { index: false }));

function esc(s = '') {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function songId(artist, title) {
  return `${(artist || '').trim().toLowerCase()}::${(title || '').trim().toLowerCase()}`;
}

function visitorId(req, res) {
  let id = req.cookies?.[COOKIE_NAME];
  if (!id) {
    id = randomUUID();
    res.cookie(COOKIE_NAME, id, { maxAge: COOKIE_MAX_AGE, httpOnly: true, sameSite: 'lax' });
  }
  return id;
}

// Minimal cookie parser (no extra dependency)
app.use((req, _res, next) => {
  req.cookies = {};
  const header = req.headers.cookie;
  if (header) {
    header.split(';').forEach(part => {
      const [k, ...v] = part.trim().split('=');
      req.cookies[k.trim()] = decodeURIComponent(v.join('='));
    });
  }
  next();
});

// ── Metadata proxy ──────────────────────────────────────────────────────────
app.get('/api/metadata', async (req, res) => {
  try {
    const upstream = await fetch(METADATA_URL);
    const data = await upstream.json();
    res.setHeader('Cache-Control', 'no-store');
    res.json(data);
  } catch {
    res.status(502).json({ error: 'metadata unavailable' });
  }
});

// ── Ratings ──────────────────────────────────────────────────────────────────
app.get('/api/ratings/:songId', async (req, res) => {
  const vid = visitorId(req, res);
  const sid = req.params.songId;
  try {
    const [row, myRow] = await Promise.all([
      pool.query('SELECT thumbs_up, thumbs_down FROM ratings WHERE song_id = $1', [sid]),
      pool.query('SELECT vote FROM user_ratings WHERE visitor_id = $1 AND song_id = $2', [vid, sid]),
    ]);
    res.json({
      thumbsUp:   row.rows[0]?.thumbs_up   ?? 0,
      thumbsDown: row.rows[0]?.thumbs_down ?? 0,
      myVote:     myRow.rows[0]?.vote      ?? null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/ratings/:songId', async (req, res) => {
  const vid = visitorId(req, res);
  const sid = req.params.songId;
  const { vote } = req.body;
  if (vote !== 'up' && vote !== 'down') {
    return res.status(400).json({ error: 'vote must be "up" or "down"' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Ensure ratings row exists
    await client.query(
      `INSERT INTO ratings (song_id, thumbs_up, thumbs_down)
         VALUES ($1, 0, 0) ON CONFLICT (song_id) DO NOTHING`,
      [sid]
    );

    const existing = await client.query(
      'SELECT vote FROM user_ratings WHERE visitor_id = $1 AND song_id = $2',
      [vid, sid]
    );

    let myVote = null;

    if (existing.rows.length === 0) {
      // New vote
      const col = vote === 'up' ? 'thumbs_up' : 'thumbs_down';
      await client.query(`UPDATE ratings SET ${col} = ${col} + 1 WHERE song_id = $1`, [sid]);
      await client.query(
        'INSERT INTO user_ratings (visitor_id, song_id, vote) VALUES ($1, $2, $3)',
        [vid, sid, vote]
      );
      myVote = vote;
    } else if (existing.rows[0].vote === vote) {
      // Same button — unvote
      const col = vote === 'up' ? 'thumbs_up' : 'thumbs_down';
      await client.query(`UPDATE ratings SET ${col} = GREATEST(0, ${col} - 1) WHERE song_id = $1`, [sid]);
      await client.query(
        'DELETE FROM user_ratings WHERE visitor_id = $1 AND song_id = $2',
        [vid, sid]
      );
      myVote = null;
    } else {
      // Changed vote — swap counts
      const addCol    = vote === 'up' ? 'thumbs_up'   : 'thumbs_down';
      const removeCol = vote === 'up' ? 'thumbs_down' : 'thumbs_up';
      await client.query(
        `UPDATE ratings SET ${addCol} = ${addCol} + 1, ${removeCol} = GREATEST(0, ${removeCol} - 1) WHERE song_id = $1`,
        [sid]
      );
      await client.query(
        'UPDATE user_ratings SET vote = $1 WHERE visitor_id = $2 AND song_id = $3',
        [vote, vid, sid]
      );
      myVote = vote;
    }

    await client.query('COMMIT');

    const counts = await pool.query(
      'SELECT thumbs_up, thumbs_down FROM ratings WHERE song_id = $1', [sid]
    );
    res.json({
      thumbsUp:   counts.rows[0].thumbs_up,
      thumbsDown: counts.rows[0].thumbs_down,
      myVote,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// ── Home page (server-side rendered metadata) ────────────────────────────────
app.get('/', async (req, res) => {
  let html = readFileSync(join(__dirname, '..', 'public', 'index.html'), 'utf8');

  let initData = 'null';
  try {
    const upstream = await fetch(METADATA_URL);
    const d = await upstream.json();

    const currentId = songId(d.artist, d.title);
    const prev = [];
    for (let i = 1; i <= 5; i++) {
      const a = d[`prev_artist_${i}`];
      const t = d[`prev_title_${i}`];
      if ((a || t) && songId(a, t) !== currentId) {
        prev.push({ artist: a || '', title: t || '' });
      }
    }

    initData = JSON.stringify({
      artist:     d.artist     || '',
      title:      d.title      || '',
      album:      d.album      || '',
      date:       d.date       || '',
      bit_depth:  d.bit_depth  || null,
      sample_rate: d.sample_rate || null,
      prev,
    });
  } catch (_) {}

  // Inject init data just before the main script
  html = html.replace('<script src="/public/js/app.js">',
    `<script>window.__INIT__ = ${initData};</script>\n  <script src="/public/js/app.js">`);

  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Cache-Control', 'no-store');
  res.send(html);
});

// ── Health ───────────────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', db: 'connected' });
  } catch (err) {
    res.status(500).json({ status: 'error', db: err.message });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
