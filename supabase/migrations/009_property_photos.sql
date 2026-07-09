-- Migration 009: Property photos — displayed on property card and detail view

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. properties: store photo URL uploaded by staff
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Supabase Storage bucket for property photos
--    Unlike maintenance-photos (private, sensitive tenant-submitted images),
--    property photos are not sensitive and are meant to be shown directly via
--    <img src> without generating signed URLs. public=true means Supabase
--    serves objects from the /storage/v1/object/public/... endpoint with no
--    RLS check at all — so properties.photo_url can store the plain public
--    URL returned by getPublicUrl() and it will always resolve.
-- ─────────────────────────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'property-photos',
  'property-photos',
  true,
  10485760, -- 10 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: service role (backend) can do everything. Our API routes use
-- the service-role client (lib/integrations/supabase.ts) which bypasses RLS
-- already, but we add this policy for consistency with the maintenance-photos
-- pattern and so behavior stays correct if a route ever switches keys.
CREATE POLICY "service_role_all_property_photos"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'property-photos')
  WITH CHECK (bucket_id = 'property-photos');

-- Authenticated SELECT policy: unlike maintenance-photos, this is genuinely
-- redundant rather than defense-in-depth. maintenance-photos is a private
-- bucket, so its manager_read_own_maintenance_photos policy is what makes
-- authenticated reads possible at all, and it scopes by client_id (folder
-- convention {client_id}/{conversation_id}/{filename}) because the photos
-- are tenant-submitted and may contain sensitive content.
--
-- property-photos is public, so Supabase serves every object from the public
-- endpoint with zero RLS involvement regardless of this policy — there is no
-- "unauthorized" property photo to protect against, any visitor with the URL
-- can already load it. The only thing an authenticated-SELECT policy affects
-- here is SDK-mediated access (e.g. supabase.storage.from().list()/.download()
-- called with a user's session instead of a plain public URL). We add a
-- permissive (non-client-scoped) policy for that path rather than a
-- per-client one, because scoping by client_id would require the object path
-- to start with {client_id}/... and we're recommending {property_id}/...
-- (see below) — and there is no confidentiality reason to pay that
-- complexity cost for images that are public by design.
CREATE POLICY "authenticated_read_property_photos"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'property-photos');

-- Recommended object path convention for API routes uploading to this bucket:
--   {property_id}/{filename}
-- property_id alone is sufficient (properties.client_id already scopes
-- ownership at the DB layer via the properties table's own RLS/FK), and
-- there's no need to prefix with client_id since this bucket carries no
-- per-client access control (see policy comment above).
