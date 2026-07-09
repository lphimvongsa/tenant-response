---
name: schema-managers
description: managers table columns, constraints, and the auth.users split (name/email live in auth, not here)
metadata:
  type: schema
---

`managers` (created 002_schema.sql, extended 004_schema_improvements.sql, 013_manager_contact_prefs.sql):

- `id UUID PK`
- `client_id UUID NOT NULL FK clients ON DELETE CASCADE`
- `supabase_user_id UUID NOT NULL FK auth.users ON DELETE CASCADE`, `UNIQUE` — one manager row
  per Supabase Auth user
- `role TEXT NOT NULL DEFAULT 'manager'` — constrained via `managers_role_check` CHECK to
  `'admin' | 'manager' | 'viewer'` (004)
- `phone TEXT` (013) — nullable, optional contact phone. Not validated E.164 at the DB layer;
  no SMS actually gets sent to it yet (no sending system exists — Notification Preferences tab
  is a persisted-stub only).
- `notify_email BOOLEAN NOT NULL DEFAULT true`, `notify_sms BOOLEAN NOT NULL DEFAULT true` (013)
  — toggle state for a notification system that doesn't exist yet.

**Important split:** name and email are NOT columns on `managers` — they live in Supabase Auth
(`auth.users.user_metadata.name` and `auth.users.email`), resolved via
`supabase.auth.admin.getUserById(supabase_user_id)` (service-role only; `auth.users` isn't
queryable directly via `.from()`). See [[decision_admin_authorization_boundary]] for the
data-access layer (`lib/integrations/team.ts`) built around this table for the Settings page
(Manage Teammates tab), and [[decision_auth_and_join_codes]] for `getCurrentManager()`, which
now also returns `managerId` (the `managers.id` PK, added alongside 013) in addition to
`userId` (the `auth.users` id / `supabase_user_id`) — the two are easy to confuse, don't merge them.

Indexes: `idx_managers_supabase_user_id` (004) — hit on every RLS check via `auth_client_id()`.

RLS (003_rls.sql): only `manager_read_own_row` (FOR SELECT, `supabase_user_id = auth.uid()`)
exists. **No INSERT/UPDATE/DELETE policy exists for `managers` at all** — with RLS enabled and
no policy granting a given operation, that operation is denied outright for the `authenticated`
role. This is a deliberate (if implicit) defense-in-depth backstop: even if a Server Action bug
somehow ran an update through a session-scoped client instead of the service-role client, RLS
would still reject it. All writes to `managers` (role changes, teammate removal, contact-info
updates, and any future ones) MUST go through the service-role client
(`lib/integrations/supabase.ts`).
