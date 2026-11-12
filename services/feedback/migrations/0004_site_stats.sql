-- Site visit and store-click counters (no cookies, no IP, no per-person rows).
-- One row per KST day, kind, page and traffic source, and count goes up by one per event.
CREATE TABLE site_stats (
  day TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('visit', 'store')),
  page TEXT NOT NULL,
  source TEXT NOT NULL,
  campaign TEXT NOT NULL,
  store TEXT NOT NULL CHECK (store IN ('', 'app', 'play')),
  count INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (day, kind, page, source, campaign, store)
);
