-- Migration 006: Add location column to tickets and enforce per-issue uniqueness

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Add location as a first-class column
--    Previously buried in the description string — now indexable and queryable.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS location TEXT;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Partial unique index — one open ticket per (conversation, category, location)
--
--    Allows:  plumbing + kitchen   AND  plumbing + bathroom  (different locations)
--    Allows:  plumbing + kitchen   AND  electrical + kitchen  (different categories)
--    Blocks:  plumbing + kitchen   re-inserted while already open
--
--    "Resolved" or "closed" tickets are excluded so a resolved issue can be
--    re-opened as a fresh ticket without violating the constraint.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_no_dup_open_issue
  ON tickets (conversation_id, category, location)
  WHERE status NOT IN ('resolved', 'closed');
