-- Phase 1 seed: single hardcoded client.
-- Replace twilio_number and escalation_contact with real values before running.
INSERT INTO clients (id, name, twilio_number, escalation_contact)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'Demo Property Management',
  '+1xxxxxxxxxx',           -- replace with your Twilio number
  'manager@example.com'     -- replace with real escalation contact
)
ON CONFLICT DO NOTHING;
