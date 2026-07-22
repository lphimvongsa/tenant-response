-- Migration 014: Notification infrastructure
--
-- Adds web-push subscriptions, per-event-type x per-channel notification
-- preferences on managers, and the pieces needed for a Supabase-side
-- (pg_cron + pg_net) end-of-day unread digest that doesn't depend on
-- Vercel's cron-frequency plan limits.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. push_subscriptions: one row per browser/device a manager has enabled
--    push notifications on (Web Push standard endpoint + keys)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  manager_id UUID NOT NULL REFERENCES managers (id) ON DELETE CASCADE,
  endpoint   TEXT NOT NULL UNIQUE,
  p256dh     TEXT NOT NULL,
  auth       TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_manager_id
  ON push_subscriptions (manager_id);

-- Same backstop as `managers` (003_rls.sql): no INSERT/UPDATE/DELETE policy
-- means the authenticated role can't touch this table at all. All access
-- (subscribe/unsubscribe routes, the notification dispatcher) goes through
-- the service-role client.
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. managers: per-event-type x per-channel notification preferences.
--    Replaces the flat notify_sms toggle for these event types (notify_sms /
--    notify_email columns are left in place per this repo's additive
--    migration convention — see escalation_contact/escalation_config in
--    004_schema_improvements.sql for precedent — but are no longer read by
--    the new notification dispatcher).
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE managers
  ADD COLUMN IF NOT EXISTS notification_prefs JSONB NOT NULL DEFAULT
    '{"message":{"push":true,"sms":false},
      "ticket_created":{"push":true,"sms":false},
      "escalation":{"push":true,"sms":true},
      "digest":{"push":true,"sms":false}}';

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. clients: dedup guard so the digest cron (which polls every 15 min)
--    only sends once per client per local day
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS last_digest_sent_on DATE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. EOD digest scheduling: pg_cron fires every 15 min and calls the app's
--    /api/cron/digest route via pg_net, independent of Vercel cron limits.
--    app_config holds the callback URL + shared secret so neither is
--    hardcoded into this (git-tracked) migration file — the operator
--    populates it once after deploy (see supabase-agent notes / plan).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE IF NOT EXISTS app_config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Idempotent: unschedule any existing job of this name before scheduling,
-- so re-running this migration doesn't create duplicate cron jobs.
DO $$
BEGIN
  PERFORM cron.unschedule('eod-digest');
EXCEPTION WHEN OTHERS THEN
  NULL; -- no existing job named eod-digest yet
END
$$;

SELECT cron.schedule(
  'eod-digest',
  '*/15 * * * *',
  $cron$
  DO $do$
  BEGIN
    IF EXISTS (SELECT 1 FROM app_config WHERE key = 'digest_url')
       AND EXISTS (SELECT 1 FROM app_config WHERE key = 'digest_secret') THEN
      PERFORM net.http_post(
        url := (SELECT value FROM app_config WHERE key = 'digest_url'),
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || (SELECT value FROM app_config WHERE key = 'digest_secret'),
          'Content-Type', 'application/json'
        )
      );
    END IF;
  END
  $do$;
  $cron$
);
