-- Initial schema
CREATE TABLE IF NOT EXISTS example (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ratings (
  song_id    TEXT PRIMARY KEY,
  thumbs_up  INTEGER NOT NULL DEFAULT 0,
  thumbs_down INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS user_ratings (
  visitor_id TEXT NOT NULL,
  song_id    TEXT NOT NULL,
  vote       TEXT NOT NULL CHECK (vote IN ('up','down')),
  PRIMARY KEY (visitor_id, song_id)
);
