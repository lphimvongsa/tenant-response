-- Migration 008: Message read tracking + Realtime

-- is_read tracks whether a staff member has viewed an inbound message
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT false;

-- Outbound messages are inherently "read" — staff wrote them
UPDATE messages SET is_read = true WHERE direction = 'outbound';

-- Index for fast "unread in conversation" queries
CREATE INDEX IF NOT EXISTS idx_messages_unread
  ON messages (conversation_id, direction, is_read);

-- Required for UPDATE events in Supabase Realtime
ALTER TABLE messages REPLICA IDENTITY FULL;

-- Add messages to the Realtime publication (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
  END IF;
END
$$;

-- Phase 1: no auth implemented yet — allow anon key to subscribe to message inserts
-- This is consistent with the rest of the app which uses service key without auth checks
CREATE POLICY "anon_read_messages_realtime"
  ON messages FOR SELECT TO anon USING (true);
