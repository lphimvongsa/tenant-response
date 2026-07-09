---
name: supabase-data
description: tenant-response data-fetching — server Supabase client location, Phase 1 single-tenant client_id, conversation/ticket query shapes
metadata:
  type: project
---

**Server-side Supabase client: `lib/integrations/supabase.ts`** (exports `supabase`, created with `SUPABASE_SERVICE_KEY` — service role, bypasses RLS, server-only). Server components and API routes import this directly. Do NOT import it in `'use client'` components.

**Client scoping is now auth-based (Supabase Auth wired in 2026-07).** Canonical pattern for dashboard Server Components: `const manager = await getCurrentManager()` from `lib/integrations/supabase-auth.ts` (returns `{ userId, clientId, role } | null`), then `if (!manager) redirect('/')`, then add `.eq('client_id', manager.clientId)` to EVERY query. This is mandatory because the service-role `supabase` client bypasses RLS — scoping must be done by hand in each query or you leak cross-tenant data. `proxy.ts` (Next 16's middleware replacement) already gates `/dashboard/**` for unauthenticated users, so the null-manager `redirect('/')` is just a defensive fallback. The old single-tenant patterns (hardcoded `client_id = 1`, `clients.select('id').limit(1).single()`) have been removed from overview/properties/maintenance pages.

`lib/integrations/supabase-auth.ts` also exports `createServerSupabaseClient()` — an anon-key, cookie-scoped client where RLS DOES apply; `getCurrentManager` uses it. Auth Server Actions live in `app/login/actions.ts` (`signIn`, `signUp`, `signOut`). Login/signup UI is the `/` landing page: `app/page.tsx` (server shell) renders `components/auth/AuthForms.tsx` ('use client', CSS-module styled, uses `useActionState`). `managers` table maps `supabase_user_id` -> `client_id`; `clients.join_code` gates signup.

**Common query shapes:**
- Conversation list/detail: `.from('conversations').select('id, status, created_at, last_message_at, tenants(id, phone, name), messages(body, direction, created_at)').order('last_message_at', { ascending: false, nullsFirst: false })`. Supabase types nested relations loosely, so cast: `(data ?? []) as unknown as Conversation[]`.
- Tickets: `.from('tickets').select('id, category, location, severity, description, status, photo_url, assigned_to, created_at, unit_id, tenants(id, name, phone), units(id, unit_number, properties(id, name))')`. Severity is 'mild'|'moderate'|'severe'|null. **Status taxonomy widened 2026-07 to 'open'|'in_progress'|'in_review'|'resolved'|'closed'** (no DB CHECK constraint, so no migration). `tickets.assigned_to` is a free-text string|null (assignee name). Ticket type lives in `components/maintenance/TicketList.tsx` (widened + `assigned_to` + nested `units.properties`).
- **"Outstanding/open" ticket counts = `['open','in_progress','in_review']`, NOT just `status==='open'`.** Applied via `.in('status', [...])` (dashboard overview open-tickets count) or `OUTSTANDING_STATUSES.includes(t.status)` (properties list `countOpenTickets`, PropertyProfile per-unit count). If you add any new "open ticket" logic, use this 3-status set or you'll undercount tickets sitting in progress/review.
- Count-only queries use `.select('id', { count: 'exact', head: true })`.

Conversation `status` is 'active'|'escalated' (escalated = needs manual response). Messages `direction` is 'inbound'|'outbound'. Shared types in `types/index.ts` (Conversation, ConversationTenant, etc.) — no Ticket type there yet; maintenance page defines its own local Ticket type.

Every data-fetching component must handle the Supabase `error` (render an error panel) and empty states.
