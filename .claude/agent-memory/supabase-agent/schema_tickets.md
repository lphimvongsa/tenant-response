---
name: schema-tickets
description: tickets table columns, category taxonomy CHECK constraint, and related indexes
metadata:
  type: schema
---

`tickets` (created 002_schema.sql, extended 004_schema_improvements.sql, 006_ticket_location.sql,
011_ticket_taxonomy.sql):

- `id UUID PK`, `client_id UUID NOT NULL FK clients ON DELETE CASCADE`
- `unit_id UUID FK units ON DELETE SET NULL`
- `tenant_id UUID FK tenants ON DELETE SET NULL`, `conversation_id UUID FK conversations ON DELETE SET NULL`
- `category TEXT` — free text historically (AI-generated, only prompt-guided, not constrained).
  As of 011_ticket_taxonomy.sql, constrained via `tickets_category_check` CHECK to `NULL` or
  (case-insensitively, via `lower(category) IN (...)`) one of 12 canonical lowercase values:
  `plumbing, electrical, hvac, appliance, cosmetic, security, gas, pest, structural, exterior,
  safety_devices, other`. Constraint was added `NOT VALID` — legacy rows are NOT guaranteed to
  match or be lowercase yet; only new writes/updates are enforced. A follow-up migration must run
  `ALTER TABLE tickets VALIDATE CONSTRAINT tickets_category_check;` once legacy data is
  audited/backfilled. App-layer normalizes new writes to lowercase (parallel work, not owned by
  this agent).
- `title TEXT` — added 011_ticket_taxonomy.sql, nullable, no backfill. Short human-readable title
  distinct from `description`; app falls back to deriving one from `description` when NULL.
- `severity TEXT`, `status TEXT NOT NULL DEFAULT 'open'`, `description TEXT NOT NULL`
- `location TEXT` (006) — first-class column, previously buried in description
- `assigned_to TEXT`, `resolved_at TIMESTAMPTZ`, `created_at`/`updated_at TIMESTAMPTZ`
  (`updated_at` maintained by shared `set_updated_at()` trigger, see [[pattern_migration_style]])

Indexes: `idx_tickets_client_status (client_id, status)`, `idx_tickets_unit_id`,
`idx_tickets_tenant_id`, `idx_tickets_conversation_id`, `idx_tickets_client_category
(client_id, category)` (011), plus partial unique `idx_tickets_no_dup_open_issue
(conversation_id, category, location) WHERE status NOT IN ('resolved','closed')` (006) —
prevents duplicate open tickets for the same issue while allowing re-opening after resolution.

No `supabase/config.toml` or CLI migration-apply script exists in this repo as of 2026-07 — new
migration files are created but not auto-applied; confirm with the user whether/how they push
migrations to their Supabase project.
