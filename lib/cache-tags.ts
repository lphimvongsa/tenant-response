// Shared cache-tag names for unstable_cache()/revalidateTag(). Both the cached
// page reads and the mutation routes that call revalidateTag import these
// constants so the tag strings can never drift out of sync between the two
// sides.
//
// Tags are domain-wide (not per-client) — unstable_cache's `tags` option is
// fixed at wrap time, not per-call, so a per-client tag isn't practical here.
// That's fine for correctness: each cache entry is still isolated per client
// because clientId is always passed as an argument to the cached function
// (part of its cache key). A domain-wide tag only means one client's mutation
// also invalidates other clients' cached reads for that domain — a bit of
// extra recomputation, not a data leak. Revisit if the number of clients
// grows large enough for that to matter.

export const PROPERTIES_TAG = 'properties'
export const TICKETS_TAG = 'tickets'
export const CONVERSATIONS_TAG = 'conversations'
