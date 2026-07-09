-- Migration 011: Ticket category taxonomy + title column

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. tickets: add title
--    Short human-readable ticket title (e.g. "Leaking faucet"), distinct from
--    the existing full-text `description` column. Nullable — existing rows
--    stay NULL and the app derives a fallback title from `description`.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS title TEXT;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. tickets.category: lock to a 12-value taxonomy
--
--    `category` was previously free text, only loosely steered by an AI
--    prompt description rather than actually constrained — real rows may
--    contain arbitrary casing or values outside this list. The app layer is
--    being updated (in parallel) to normalize all new writes to lowercase.
--
--    Added NOT VALID: Postgres skips scanning/enforcing existing rows when a
--    CHECK constraint is added this way, so this cannot fail or block on
--    legacy data no matter what garbage is already in the column. The
--    constraint is still fully enforced for all *new* inserts and any future
--    update that touches an existing row (NOT VALID only defers validation of
--    rows that predate the constraint — it does not weaken enforcement going
--    forward).
--
--    Deliberately NOT running VALIDATE CONSTRAINT here: that would require a
--    full-table scan and would fail outright if any legacy row doesn't match
--    (or isn't lowercase). Once legacy `category` values have been audited/
--    backfilled to the canonical lowercase taxonomy, a follow-up migration
--    should run:
--        ALTER TABLE tickets VALIDATE CONSTRAINT tickets_category_check;
--    (VALIDATE CONSTRAINT only takes SHARE UPDATE EXCLUSIVE — it does not
--    block concurrent reads/writes the way adding the constraint without
--    NOT VALID would have.)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE tickets DROP CONSTRAINT IF EXISTS tickets_category_check;
ALTER TABLE tickets ADD CONSTRAINT tickets_category_check
  CHECK (
    category IS NULL
    OR lower(category) IN (
      'plumbing', 'electrical', 'hvac', 'appliance', 'cosmetic', 'security',
      'gas', 'pest', 'structural', 'exterior', 'safety_devices', 'other'
    )
  ) NOT VALID;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Index to support per-client category filtering on the dashboard
-- ─────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tickets_client_category
  ON tickets (client_id, category);
