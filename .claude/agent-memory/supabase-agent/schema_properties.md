---
name: schema-properties
description: properties table columns and the storage buckets attached to it (property photos)
metadata:
  type: project
---

`properties` table (migration 007_properties.sql, extended by 009_property_photos.sql):
- `id UUID PK`, `client_id UUID NOT NULL REFERENCES clients(id) ON DELETE CASCADE`, `name TEXT`, `address TEXT`, `created_at`, `updated_at`
- RLS: `manager_access_own_properties` scopes ALL to `client_id = auth_client_id()`
- `units.property_id` FK → `properties.id ON DELETE CASCADE`
- `photo_url TEXT` (nullable, added in migration 009) — plain public URL for the property's photo, rendered directly via `<img src>`

Storage bucket `property-photos` (migration 009_property_photos.sql):
- `public: true` (unlike `maintenance-photos` which is private) — property photos aren't sensitive, no signed URLs needed
- 10MB file size limit, mime types: image/jpeg, image/png, image/webp, image/gif
- Object path convention: `{property_id}/{filename}` — no `client_id` prefix, since the bucket has no per-client RLS scoping (public buckets serve via the public endpoint with zero RLS check)
- RLS policies: `service_role_all_property_photos` (FOR ALL, service_role) and `authenticated_read_property_photos` (FOR SELECT, authenticated, unscoped) — the authenticated policy is acknowledged as redundant in a SQL comment since public buckets don't enforce RLS on the public serving endpoint anyway; it only matters for SDK-mediated list/download calls made with a user session.

See [[decision_public_vs_private_storage_buckets]] for the reasoning on public vs private bucket choice and path convention tradeoffs.
