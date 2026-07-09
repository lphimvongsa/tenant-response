---
name: pattern-migration-style
description: SQL migration file conventions used in supabase/migrations/ (numbering, formatting, idempotency)
metadata:
  type: patterns
---

Migrations are numbered `NNN_description.sql` (currently 001-010, zero-padded 3 digits, not the
`YYYYMMDDHHMMSS` format in generic Supabase docs — this repo uses simple sequential numbers).

Formatting conventions observed across 002/003/004/007/009/010:
- Header comment: `-- Migration NNN: Short title`
- Multi-step migrations use a section divider comment
  (`-- ─────────────────────────────────────────────────────────────────────────────`)
  before each numbered step (`-- 1. ...`, `-- 2. ...`), with a one-line "why" underneath when the
  reasoning isn't obvious. Single-purpose migrations (one column, one table) skip the dividers.
- `ADD COLUMN IF NOT EXISTS` / `DROP CONSTRAINT IF EXISTS` guards are used consistently for
  re-runnability, even though this repo doesn't otherwise formalize idempotency testing.
- Trigger-based `updated_at` columns all reuse the shared `set_updated_at()` function defined in
  004_schema_improvements.sql — don't redefine per table.
- RLS policy naming: `manager_access_own_<table>` for FOR ALL policies scoped by
  `client_id = auth_client_id()`, `manager_read_own_<table>` for SELECT-only policies. New tables
  needing manager access should follow this naming exactly (see 007_properties.sql).
- Storage buckets: see [[decision_public_vs_private_storage_buckets]] for the public/private
  bucket + path-convention pattern (009_property_photos.sql is the reference implementation).

Also see [[decision_auth_and_join_codes]] for the first migration/lib work related to real
Supabase Auth login.

Adding a CHECK constraint to an already-populated column with unvalidated legacy data
(011_ticket_taxonomy.sql, tickets.category): use `DROP CONSTRAINT IF EXISTS` +
`ADD CONSTRAINT ... CHECK (...) NOT VALID`. NOT VALID skips scanning/enforcing existing rows
at ADD time (so the migration can't fail on legacy garbage), but the constraint is still fully
enforced on all new INSERTs and on any UPDATE touching an existing row — it only defers
validation of pre-existing rows. Do NOT immediately run `VALIDATE CONSTRAINT` in the same
migration if legacy data isn't known-clean — that forces the full-table scan/enforcement
immediately and defeats the purpose. Leave validation for a separate follow-up migration once
legacy data has been audited/backfilled to match.
