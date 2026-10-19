ALTER TABLE ideas ADD COLUMN status TEXT NOT NULL DEFAULT 'open'
  CHECK (status IN ('open', 'reviewing', 'planned', 'completed'));
