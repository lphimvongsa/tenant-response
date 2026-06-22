-- Migration 005: Fields and storage needed for AI response flows

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. messages: store MMS media URL (downloaded from Twilio and re-hosted)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS media_url TEXT;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. tickets: store maintenance photo URL from Supabase Storage
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE tickets
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Supabase Storage bucket for maintenance photos
--    private=false means URLs are accessible; RLS on storage.objects controls
--    actual access. Switch to public=true only if you want unauthenticated URLs.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'maintenance-photos',
  'maintenance-photos',
  false,
  10485760, -- 10 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: service role (backend) can do everything.
-- Authenticated managers can read photos belonging to their client.
CREATE POLICY "service_role_all_maintenance_photos"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'maintenance-photos')
  WITH CHECK (bucket_id = 'maintenance-photos');

CREATE POLICY "manager_read_own_maintenance_photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'maintenance-photos'
    -- path is: {client_id}/{conversation_id}/{filename}
    AND (storage.foldername(name))[1] = auth_client_id()::text
  );
