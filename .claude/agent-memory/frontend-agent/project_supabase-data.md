---
name: supabase-data
description: tenant-response data-fetching — server Supabase client location, Phase 1 single-tenant client_id, conversation/ticket query shapes
metadata:
  type: project
---

**Server-side Supabase client: `lib/integrations/supabase.ts`** (exports `supabase`, created with `SUPABASE_SERVICE_KEY` — service role, bypasses RLS, server-only). Server components and API routes import this directly. Do NOT import it in `'use client'` components.

**Phase 1 is single-tenant.** Two patterns coexist for resolving the client id:
- Hardcoded `client_id = 1` (used in overview stat queries per spec).
- Dynamic lookup `supabase.from('clients').select('id').limit(1).single()` (used in `app/dashboard/properties/page.tsx`).

**Common query shapes:**
- Conversation list/detail: `.from('conversations').select('id, status, created_at, last_message_at, tenants(id, phone, name), messages(body, direction, created_at)').order('last_message_at', { ascending: false, nullsFirst: false })`. Supabase types nested relations loosely, so cast: `(data ?? []) as unknown as Conversation[]`.
- Tickets: `.from('tickets').select('id, category, location, severity, description, status, created_at, tenants(id, name, phone)')`. Severity is 'mild'|'moderate'|'severe'; status 'open'|'resolved'|'closed'.
- Count-only queries use `.select('id', { count: 'exact', head: true })`.

Conversation `status` is 'active'|'escalated' (escalated = needs manual response). Messages `direction` is 'inbound'|'outbound'. Shared types in `types/index.ts` (Conversation, ConversationTenant, etc.) — no Ticket type there yet; maintenance page defines its own local Ticket type.

Every data-fetching component must handle the Supabase `error` (render an error panel) and empty states.
