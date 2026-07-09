---
name: decision-auth-and-join-codes
description: Invite-style signup via clients.join_code, and the session-scoped vs service-role Supabase client split for real Supabase Auth
metadata:
  type: decision
---

Migration `supabase/migrations/010_join_codes.sql` added `clients.join_code TEXT UNIQUE NOT NULL`
(backfilled via `substr(md5(random()::text), 1, 8)` per existing row before the NOT NULL was
applied — UNIQUE tolerates multiple NULLs pre-backfill so the ADD COLUMN → UPDATE → SET NOT NULL
order is safe and matches this repo's migration style).

**Why:** Real Supabase Auth login is being added. Signup is invite-style — a new manager provides
a join code to identify which `clients` row (property group) they belong to, rather than being
pre-provisioned by an admin. This is the first migration to touch auth-adjacent flows; before this,
`managers.supabase_user_id → auth.users(id)` existed (002_schema.sql) and RLS via `auth_client_id()`
existed (003_rls.sql), but nothing in the app exercised them — everything used the service-role
client.

**How to apply:** Any future signup/join-code redemption logic should look up `clients` by
`join_code` (case-sensitive exact match, 8-char md5-derived string) to resolve `client_id` before
inserting a `managers` row for the new `auth.users` id.

Companion piece: `lib/integrations/supabase-auth.ts` established the third Supabase client for this
project (in addition to `lib/integrations/supabase.ts` service-role and
`lib/integrations/supabase-browser.ts` anon/browser):
- `createServerSupabaseClient()` — async function (not a const) using `@supabase/ssr`'s
  `createServerClient` with `next/headers` `cookies()` (awaited — Next 16 cookies() is async in
  this repo). `setAll` is wrapped in try/catch-and-ignore because it throws when called from a
  Server Component (no response to attach cookies to); middleware is expected to own the actual
  session-cookie refresh. For use in Server Components, Route Handlers, Server Actions.
- `getCurrentManager()` — calls `auth.getUser()` on that session client, then queries `managers`
  via the SAME session client (relying on the `manager_read_own_row` RLS policy), never the
  service-role client — the whole point is to prove RLS actually gates the query. Returns
  `{ userId, clientId, role } | null`.

**Why session client for the managers lookup specifically:** using service-role here would silently
bypass the only RLS policy this feature is meant to exercise, defeating the purpose of adding real
auth. Keep this asymmetry in mind for any future "get current user's X" helper — check `USING`
clauses in `supabase/migrations/003_rls.sql` to confirm session-client access is actually granted
before adding a new helper this way.

See also [[pattern_migration_style]] for the SQL formatting conventions these files follow.
