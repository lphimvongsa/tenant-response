---
name: conversation-escalation
description: How the conversation escalation workflow (status='escalated') works and where its pieces live, added 2026-07-08
metadata:
  type: project
---

`conversations.status` (TEXT, default 'active', no CHECK constraint) gained a second known value, 'escalated', alongside 'active'. This is set by `lib/execute-flow.ts`'s `handleEmergency` when the AI router detects an `emergency` intent. It is a **separate mechanism** from the `ai_enabled` boolean column (manual manager takeover) — the two guards are independent and both live in `app/api/twilio/route.ts`:

- STAGE 2A guard (pre-existing): `if (!aiEnabled) return emptyTwiML` — manager manually disabled AI.
- STAGE 2B guard (added 2026-07-08): `if (wasEscalated) return emptyTwiML` — conversation flagged escalated, bot must stay silent until a human resolves it. `wasEscalated` is only set `true` inside the `existingConv` branch (`existingConv.status === 'escalated'`); the new-conversation insert branch never sets it, since a brand-new conversation can't start out escalated.

`app/api/conversations/[id]/resolve/route.ts` is the un-escalate endpoint: manager-authenticated POST that sets `status` back to `'active'` (scoped `.eq('id', id).eq('client_id', manager.clientId)`), which re-enables the STAGE 2B bot guard. Returns `{ id, status }` on success — this exact shape is relied on by a frontend "Resolve" button, don't change it without checking frontend-agent's wiring.

Added 2026-07-08: `app/api/conversations/[id]/escalate/route.ts` is an exact mirror of `resolve/route.ts` (same auth/scoping/response shape) except it sets `status` to `'escalated'` instead of `'active'`. It's the manual, staff-initiated counterpart to a dashboard "Escalated ⇄ AI Active" dropdown — deliberately does NOT send an SMS alert or write to `actions_log` (unlike the automatic `handleEmergency` path), since both paths converge on the same `conversations.status` column and the STAGE 2B guard in twilio's route.ts doesn't care which path set it.

**Why:** lets a human take over indefinitely once the AI detects an emergency, without touching the unrelated manual-takeover (`ai_enabled`) flag. The manual escalate endpoint exists so staff can proactively silence the bot even when the AI never detected an emergency intent.

**How to apply:** if asked to touch escalation logic again, remember it spans two files owned by two different agents — `app/api/twilio/route.ts` (twilio-agent) and `app/api/conversations/[id]/resolve/route.ts` + `.../escalate/route.ts` (mine). Keep resolve and escalate as exact mirrors of each other (same auth/scoping/error shape) unless told otherwise. See [[ownership-boundary-twilio]].
