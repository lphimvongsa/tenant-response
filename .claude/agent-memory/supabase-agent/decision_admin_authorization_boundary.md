---
name: decision-admin-authorization-boundary
description: Why cross-manager operations (teammate list/remove, join-code rotation) are authorized in the Server Action layer instead of via RLS, and where the data-access layer for that lives
metadata:
  type: decision
---

Settings page work (Manage Teammates + join code rotation, 2026-07): the user explicitly chose
**not** to add new RLS policies for "admin can read/remove any teammate in their client" or
"admin can rotate their client's join code." Reasoning (the user's own, given up front — not
something I derived): RLS `USING`/`WITH CHECK` clauses scoped by `client_id` can restrict *which
rows* are touched but not *which columns* — a broadened UPDATE policy on `managers` scoped by
`client_id = auth_client_id()` would let any manager (not just admins) update their own `role` or
`client_id` via that same policy, which is a privilege-escalation path. So instead:

- `lib/integrations/team.ts` (new, this migration round) holds all cross-manager operations
  (`getTeammates`, `getJoinCode`, `regenerateJoinCode`, `removeTeammate`) plus the self-scoped
  `updateOwnContactInfo`. All five use the service-role client
  (`import { supabase as supabaseAdmin } from '@/lib/integrations/supabase'`), same alias
  convention as `app/login/actions.ts`.
- None of these functions check `role === 'admin'` themselves — they trust the caller. The
  Server Action layer (built by a different agent, next) is responsible for calling
  `getCurrentManager()` and verifying `role === 'admin'` before invoking the admin-only ones
  (`regenerateJoinCode`, `removeTeammate`, `getTeammates`/`getJoinCode` for display). This
  mirrors the existing precedent in `app/login/actions.ts`'s `signUp`, which already bypasses
  RLS with `supabaseAdmin` for the pre-auth join-code lookup and justifies it inline.
- `updateOwnContactInfo(managerId, fields)` only ever writes `phone` / `notify_email` /
  `notify_sms` — it has no code path that can touch `role` or `client_id`, by construction
  (the `fields` param's type doesn't include them). This is the actual privilege-escalation
  guard, not a runtime check — keep it that way if this function is ever extended.
- `removeTeammate` additionally scopes its DELETE by `client_id` (not just `id`) as defense in
  depth against a forged/guessed `managerId` crossing tenants, and refuses self-removal by
  comparing against `requesterManagerId` before touching the DB at all.

**RLS gap check (explicitly asked for by the user — answer: no gap found):** `managers` has no
INSERT/UPDATE/DELETE policy for `authenticated` at all (see [[schema_managers]]), so even a
session-scoped client can't write to `managers` regardless of this design — RLS default-denies
writes outright. That's an existing backstop, not something this feature needed to add. Did not
find a concrete path where the current RLS setup (no new policies) leaves a hole that
application-layer checks don't already cover. If a future change ever adds a broad
`FOR ALL`/`UPDATE` policy on `managers` scoped only by `client_id`, that would reopen the
role-escalation path this design avoids — flag it if you see one being proposed.

See [[schema_managers]] for the table itself and [[pattern_migration_style]] for migration
numbering conventions (this round added `013_manager_contact_prefs.sql`).
