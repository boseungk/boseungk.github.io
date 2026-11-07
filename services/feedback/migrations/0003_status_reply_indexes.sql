-- Performance only. Safe to apply at any time, before or after the API deploy.
-- Status filter on the public list, and latest operator reply per idea.
CREATE INDEX ideas_public_status_created ON ideas(hidden, status, created_at DESC, id DESC);
CREATE INDEX comments_operator_latest ON comments(idea_id, is_operator, hidden, created_at DESC, id DESC);
