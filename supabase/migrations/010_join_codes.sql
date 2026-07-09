-- Migration 010: Join codes — invite-style signup for managers

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. clients: add join_code
--    A new manager signs up by providing this code to identify which client
--    (property group) they belong to, rather than being pre-provisioned.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS join_code TEXT UNIQUE;

-- Backfill existing row(s) with a random 8-char code before enforcing NOT NULL.
-- UNIQUE already tolerates the pre-backfill NULLs (Postgres treats NULLs as
-- distinct for uniqueness purposes), so this order is safe.
UPDATE clients
SET join_code = substr(md5(random()::text), 1, 8)
WHERE join_code IS NULL;

ALTER TABLE clients
  ALTER COLUMN join_code SET NOT NULL;
