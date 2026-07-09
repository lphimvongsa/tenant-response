---
name: decision-public-vs-private-storage-buckets
description: When to make a Supabase Storage bucket public vs private in this project, and how that shapes object path convention and RLS policy design
metadata:
  type: decision
---

This project has two storage bucket patterns established so far:

**Private bucket** — `maintenance-photos` (migration 005_ai_fields.sql). Tenant-submitted photos attached to maintenance tickets; potentially sensitive. Path convention: `{client_id}/{conversation_id}/{filename}` so RLS can scope authenticated reads via `(storage.foldername(name))[1] = auth_client_id()::text`. Requires signed URLs or authenticated access for reads.

**Public bucket** — `property-photos` (migration 009_property_photos.sql). Staff-uploaded property photos for display on property cards/detail views; not sensitive, need to render via plain `<img src>` without signed-URL generation. `public: true` means Supabase serves objects from `/storage/v1/object/public/...` with **zero RLS check** on that endpoint — RLS policies on `storage.objects` only affect SDK-mediated calls (`.list()`, `.download()`) made with a session, not the public URL itself.

**Path convention decision**: because public buckets carry no per-client access control at the storage layer, there's no reason to prefix object paths with `{client_id}/...` the way `maintenance-photos` does — ownership is already enforced at the DB layer (properties table FK + RLS). Use `{property_id}/{filename}` (or the equivalent parent-entity id) for public buckets; reserve the `{client_id}/{entity_id}/{filename}` convention for private buckets where RLS needs to scope reads by tenant.

**How to apply**: when adding a new storage bucket, first ask whether the content is sensitive/tenant-submitted (→ private, client_id-prefixed path, RLS-scoped SELECT policy) or staff-uploaded/display-only (→ public, entity-id-prefixed path, RLS SELECT policy is documented as redundant-but-included-for-consistency rather than actually protective).
