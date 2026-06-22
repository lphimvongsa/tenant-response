# tenant-response — Technical Overview & Roadmap

## High-Level Architecture

The system is a multi-tenant SaaS where each **client** (property management company) owns a Twilio number, a knowledge base, a manager team, and a stream of tenant SMS conversations. The same Next.js application serves both the **Twilio webhook ingestion path** (machine-to-machine, no auth, service-role DB access) and the **manager dashboard** (human-to-machine, Supabase Auth, RLS-enforced DB access). The boundary between those two access modes is the most important security invariant in the system.

```
┌─────────┐   SMS   ┌─────────────────┐  insert  ┌──────────────┐
│ Tenant  │ ──────▶ │ Twilio          │ ───────▶ │ /api/twilio  │
│ phone   │ ◀────── │ (signed POST)   │  reply   │ (Next route) │
└─────────┘         └─────────────────┘          └──────┬───────┘
                                                        │ service role
                                            ┌───────────▼───────────┐
                                            │  Supabase (Postgres   │
                                            │  + pgvector + Auth)   │
                                            └───────────▲───────────┘
                                                        │ anon key + RLS
                                                  ┌─────┴──────┐
                                                  │ Dashboard  │
                                                  │ (Next App  │
                                                  │  Router)   │
                                                  └─────┬──────┘
                                                        │
                                                   ┌────▼─────┐
                                                   │ Manager  │
                                                   └──────────┘
```

### 1. Automated Response System (RAG)

When an inbound SMS arrives at `/api/twilio`:

1. **Resolve tenancy** — `To` → `clients.twilio_number`, `From` → `tenants.phone` (insert if new), open or reuse an `active` row in `conversations`.
2. **Persist inbound** — write `messages(direction='inbound', body, conversation_id, client_id)`. Twilio's `MessageSid` is the natural dedupe key for webhook retries.
3. **Retrieve** — embed the inbound body (OpenAI `text-embedding-3-small`, 1536-dim — matches the existing `kb_chunks.embedding` column), then run a `vector_cosine_ops` ANN search on `kb_chunks` filtered by `client_id`. Top-k chunks (e.g., k=5) become grounding context.
4. **Generate** — call the LLM with: system prompt (persona + escalation rules), retrieved chunks, last N turns from `messages` for the conversation. The LLM returns either a reply, or a structured escalation signal (intent, confidence, suggested ticket fields).
5. **Send & log** — POST reply via Twilio, write `messages(direction='outbound')` and `actions_log(tool='llm_reply', args, result)`.

All writes on this path use the **service role key** because there's no authenticated user for an inbound SMS. RLS is therefore bypassed *only* on this code path.

### 2. Escalation Logic

A `conversation` has a `status` field (already in the schema: defaults to `'active'`). The state machine:

```
active ──(low confidence│emergency intent│"speak to a human")──▶ pending
pending ──(manager replies / closes)────────────────────────────▶ resolved
```

Escalation triggers, evaluated server-side on every inbound message:

- **LLM confidence below threshold** — the model returns a structured `confidence` field; below ~0.6 escalates.
- **Intent classifier** — emergency keywords (gas, fire, flood, no heat in winter) trigger immediate escalation regardless of LLM confidence.
- **Explicit tenant request** — phrases like "talk to a person", "manager", "human" pattern-match to escalate.
- **Repeated unresolved turns** — counter on `conversations` (would need a small migration) tracks low-confidence streak.
- **Tool failure** — any unrecoverable LLM/Twilio error escalates by default.

On escalation: insert `tickets(client_id, unit_id, category, severity, description, status='open')`, set `conversations.status = 'pending'`, **suppress further auto-replies until a manager acts**, and notify `clients.escalation_contact` (email or SMS).

### 3. Manager Dashboard

Server-rendered Next.js routes under a protected route group (e.g., `app/(dashboard)/...`). Authentication via **Supabase Auth**; each authenticated user has a row in `managers` linking `supabase_user_id` → `client_id`. The pre-existing `auth_client_id()` SQL helper in migration `003_rls.sql` and the `manager_access_own_*` policies do the multi-tenant filtering — the app code does **not** filter by `client_id` itself, it just queries and lets RLS scope the results.

Core surfaces:

- **Conversations list** — `conversations` joined with latest `messages` row and `tenants.phone`, sorted by latest activity. Live updates via Supabase Realtime subscription.
- **Conversation detail** — full `messages` thread, status pill, "send manual reply" composer.
- **Tickets queue** — `tickets` filtered by status, sortable by severity.
- **Knowledge base admin** — upload documents → server action chunks, embeds, writes `kb_documents` + `kb_chunks`.

Manual replies and ticket status changes route through server actions (or route handlers) that use the **service role** to send via Twilio + write `messages`, then write `actions_log(approved_by = manager.id)` for auditability.

---

## Phased Roadmap

### Phase 1 — Baseline (✅ done)

**Shipped:**
- `app/api/twilio/route.ts` with Twilio signature validation
- Hardcoded `resolveClient` mapping the configured number to `client_phase1`
- Static canned reply via `twilioClient.messages.create()`
- Supabase migrations + seed authored, env vars wired, Vercel deploy live

**Not yet:** no DB writes, no LLM, no dashboard.

### Phase 2 — Dynamic Intelligence

Goal: every inbound SMS is logged, contextually answered from the client's KB, and the conversation history is queryable.

**2.1 Database wiring**
- Replace `resolveClient` with a `clients` table lookup by `twilio_number` (use `lib/supabase-server.ts`, single-row `.maybeSingle()`).
- Find-or-create `tenants` row by `phone` (scoped to `client_id`).
- Find-or-create open `conversations` row (status `'active'` for that tenant).
- Insert inbound `messages` row. Use Twilio's `MessageSid` as an idempotency key — add a unique index migration (`messages_message_sid_key`) and an `ON CONFLICT DO NOTHING` insert so webhook retries don't double-log.

**2.2 KB ingestion (one-off admin tool first)**
- Script or unauthenticated CLI route to: read documents → chunk (~500-token chunks, 50-token overlap) → embed via OpenAI → write `kb_documents` + `kb_chunks`.
- This can be a `scripts/ingest.ts` runnable with `tsx` against the service role — doesn't need to be a UI yet.

**2.3 RAG response pipeline**
- New module `lib/rag.ts`: takes `(clientId, conversationId, inboundBody)` → returns `{ reply, confidence, shouldEscalate }`.
- Internal steps: embed inbound, pgvector search filtered by `client_id`, fetch last ~10 turns from `messages`, call LLM with structured output (JSON schema with `reply`, `confidence`, `escalate_reason`).
- Replace the static `CANNED_REPLY` in `route.ts` with the RAG result. Continue sending via Twilio, log outbound to `messages`, record the call in `actions_log`.

**2.4 New env vars** — `OPENAI_API_KEY`, optionally `LLM_MODEL` / `EMBEDDING_MODEL` for swapability.

**Acceptance:** texting your Twilio number returns a KB-grounded answer; `conversations`, `messages`, `actions_log` all show rows.

### Phase 3 — Human-in-the-Loop Dashboard

Goal: managers can authenticate, see live conversations, and reply manually.

**3.1 Auth & route protection**
- Supabase Auth via `@supabase/ssr` (already in deps) — email magic link is the lowest-friction option.
- **Important Next 16 note:** the old `middleware.ts` convention is deprecated; use **`proxy.ts`** at the project root for the auth gate. The `proxy.ts` runs on the Node runtime by default in Next 16 (not Edge as `middleware.ts` was) — that affects which Supabase SSR helpers are used.
- Manager onboarding: an admin manually inserts a `managers` row mapping `supabase_user_id` → `client_id` (full invite flow can wait for Phase 4+).


**3.2 Dashboard routes** (under `app/(dashboard)/`)
- `/dashboard` — conversations list (server component, RLS-scoped query).
- `/dashboard/conversations/[id]` — message thread. Note Next 16: `params` is `Promise<{ id: string }>`, must be `await`ed.
- `/dashboard/tickets` — ticket queue.

**3.3 Realtime**
- Client component subscribes to Supabase Realtime for `messages` and `conversations` changes on the manager's `client_id`. RLS applies to realtime channels too, so no extra filtering is needed in the subscription.

**3.4 Manual reply path**
- Server action `sendManualReply(conversationId, body)`:
  1. Verify the caller's manager row owns `conversationId` (RLS-scoped query — if no row, throw).
  2. Send via `twilioClient.messages.create()` from the client's `twilio_number` to the tenant's `phone`.
  3. Insert outbound `messages` row + `actions_log(tool='manual_reply', approved_by=manager.id)`.
- A manual reply does **not** automatically reopen automation — see Phase 4.

**Acceptance:** a manager can log in, see their tenants' conversations and only their tenants' conversations, and send a manual reply that the tenant actually receives.

### Phase 4 — Advanced Escalation & RLS Hardening

Goal: production-grade escalation behavior and provable multi-tenant isolation.

**4.1 Escalation engine**
- Replace the ad-hoc Phase 2 escalation with a dedicated `lib/escalation.ts` evaluating: LLM confidence, emergency intent classifier, explicit-handoff regex, turn-count heuristic.
- On escalate: open `tickets` (LLM proposes `category`/`severity`/`description`), flip `conversations.status = 'pending'`, **stop generating auto-replies for that conversation** until status returns to `active` (after manager resolves the ticket or explicitly hands back to automation).
- Notify `clients.escalation_contact` — email via Resend/SendGrid, or SMS to a manager's phone.

**4.2 Manager actions**
- Resolve ticket → conversation returns to automation (or stays in `pending` per manager choice).
- "Take over" button → conversation marked `pending`, all future inbound messages skip the LLM and surface as notifications.
- All state changes recorded in `actions_log` with `approved_by`.

**4.3 RLS verification & hardening**
- The policies are already in `003_rls.sql`. Now we need to **prove** they hold:
  - Test suite that signs in as a manager for client A and asserts every list/detail query returns zero rows for client B's data (via PostgREST or the JS client with the anon key).
  - Confirm no dashboard code path uses the service-role key (grep). The service role must stay exclusively on the Twilio webhook + ingestion scripts + server-side mutations that need it.
  - Add an `ON DELETE` audit: ensure cascade rules don't accidentally let a manager delete a client they don't own.
- Add a `managers` insert/invite flow (admin-only) and an `auth.users` → `managers` trigger to prevent orphaned auth users.

**4.4 Observability**
- Sentry or equivalent for both the webhook path and the dashboard.
- Structured logs already partially in place (`[clientId] ...`) — extend to include `conversationId` and a request id.

**Acceptance:** an emergency keyword triggers a ticket and silences automation; a manager from client A cannot retrieve a single byte of client B's data via any API surface; every automated action is auditable in `actions_log`.

---

## Cross-Cutting Notes

- **Next.js 16 conventions** (per `AGENTS.md`): use `proxy.ts` instead of `middleware.ts`; `await params` in dynamic route handlers; consider Cache Components / `use cache` for the static parts of the dashboard; use `updateTag(tag)` in server actions for read-your-writes after a manual reply.
- **Idempotency:** Twilio retries on non-2xx for up to ~11 hours. Treat `MessageSid` as the dedup key on the inbound side; on the outbound side, store the returned `sid` on the `messages` row so we can correlate Twilio status callbacks later.
- **A2P 10DLC:** outbound delivery to US recipients is blocked at the carrier without A2P registration. Out of code scope, but a hard prerequisite for any real-world testing of Phase 2+.
- **Cost & rate limits:** every inbound SMS triggers an embedding call + LLM call + DB writes. Plan for an LLM cache keyed by `(client_id, embedding-bucket)` if traffic grows.
- **Testing:** signature validation, RAG-pipeline unit tests with mocked Twilio + OpenAI, RLS isolation integration tests. Add `vitest` (or `node:test`) as a dev dep when Phase 2 lands.

---

## Suggested Immediate Next Step

The fastest, highest-leverage thing to do next is Phase 2.1 (DB wiring) — it's small, has no external AI dependency, and unlocks everything else. Concretely: add a `messages_sid` unique migration, swap `resolveClient` for a Supabase query, and start logging both directions to `messages`. That can ship before any LLM work and immediately makes the system useful as a "conversation log + canned reply" tool.
