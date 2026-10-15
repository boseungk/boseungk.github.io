CREATE TABLE visitors (
  id TEXT PRIMARY KEY,
  token_hash TEXT UNIQUE,
  expires_at INTEGER NOT NULL,
  vote_window_started_at INTEGER NOT NULL DEFAULT 0,
  vote_request_count INTEGER NOT NULL DEFAULT 0 CHECK (vote_request_count BETWEEN 0 AND 30)
);
CREATE INDEX visitors_expiry ON visitors(expires_at);

CREATE TABLE ideas (
  id TEXT PRIMARY KEY,
  visitor_id TEXT REFERENCES visitors(id) ON DELETE SET NULL,
  nickname TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  hidden INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0, 1)),
  client_request_id TEXT NOT NULL,
  UNIQUE(visitor_id, client_request_id)
);
CREATE INDEX ideas_visitor_created ON ideas(visitor_id, created_at);
CREATE INDEX ideas_public_created ON ideas(hidden, created_at DESC, id DESC);

CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  visitor_id TEXT REFERENCES visitors(id) ON DELETE SET NULL,
  nickname TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  hidden INTEGER NOT NULL DEFAULT 0 CHECK (hidden IN (0, 1)),
  is_operator INTEGER NOT NULL DEFAULT 0 CHECK (is_operator IN (0, 1)),
  client_request_id TEXT NOT NULL,
  UNIQUE(visitor_id, client_request_id)
);
CREATE INDEX comments_visitor_created ON comments(visitor_id, created_at);
CREATE INDEX comments_public_created ON comments(idea_id, hidden, created_at, id);

CREATE TABLE votes (
  idea_id TEXT NOT NULL REFERENCES ideas(id) ON DELETE CASCADE,
  visitor_id TEXT NOT NULL REFERENCES visitors(id) ON DELETE CASCADE,
  PRIMARY KEY (idea_id, visitor_id)
);
