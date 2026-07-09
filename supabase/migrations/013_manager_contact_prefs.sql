-- Migration 013: Manager contact info + notification preferences
--
-- Supports the redesigned Settings page: a Profile tab (name/email live in
-- auth.users already; phone is new and lives here since auth.users has no
-- generic phone field we control) and a Notification Preferences tab
-- (persisted stub only — no email/SMS sending system exists yet, these
-- columns just record the manager's toggle state for when one does).

ALTER TABLE managers
  ADD COLUMN IF NOT EXISTS phone        TEXT,
  ADD COLUMN IF NOT EXISTS notify_email BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_sms   BOOLEAN NOT NULL DEFAULT true;
