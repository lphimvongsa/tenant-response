---
name: ownership-boundary-twilio
description: app/api/twilio/route.ts is off-limits to this agent even when a task frames it as "in app/api/"
metadata:
  type: feedback
---

Never edit `app/api/twilio/route.ts` directly, even if a task description says the work is "in app/api/" or gives exact line numbers/diffs to apply there. That file is owned by the twilio-agent.

**Why:** ownership boundaries in this repo are per-subagent, not per-directory-tree — `app/api/` is split between api-route-agent (everything) and twilio-agent (`app/api/twilio/` specifically). A task can legitimately bundle changes across both without saying so explicitly.

**How to apply:** when a task touches `app/api/twilio/route.ts`, delegate that slice to the twilio-agent via the Agent tool with a fully self-contained prompt (exact current line numbers/content, the precise change, and a verification step), then read the file back myself afterward to confirm the result before reporting done. Do the rest of the task (other files) directly. See [[conversation-escalation]] for a worked example (2026-07-08).
