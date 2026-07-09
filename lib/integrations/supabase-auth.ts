import { cache } from 'react'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Session-scoped Supabase client (anon key + request cookies) for Server
// Components, Route Handlers, and Server Actions — anything under
// next/headers. RLS policies (supabase/migrations/003_rls.sql) apply here,
// unlike lib/integrations/supabase.ts (service role, bypasses RLS).
// This is a function, not a module-level client, because cookies() must be
// read fresh per request.
export async function createServerSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // Server Components can't write cookies (no response to attach
            // them to) — setAll throws there. Safe to swallow: middleware is
            // what actually refreshes the session cookie on each request.
          }
        },
      },
    },
  )
}

// Resolves the logged-in manager for the current request, or null if there
// isn't one. Uses the session-scoped client above (not the service-role
// client) so the managers lookup goes through the manager_read_own_row RLS
// policy — a real session can only ever read its own manager row, which is
// exactly the scope we want here.
// Wrapped in cache() because several places in a single request tree call
// this independently (a page and its header, desktop and mobile chrome) —
// cache() dedupes those into one Supabase round trip per request.
export const getCurrentManager = cache(async (): Promise<{
  userId: string
  managerId: string
  clientId: string
  role: string
  name: string
  email: string
} | null> => {
  const supabase = await createServerSupabaseClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data, error } = await supabase
    .from('managers')
    .select('id, client_id, role')
    .eq('supabase_user_id', user.id)
    .single()

  if (error || !data) {
    return null
  }

  return {
    userId: user.id,
    managerId: data.id,
    clientId: data.client_id,
    role: data.role,
    name: (user.user_metadata?.name as string) || '',
    email: user.email || '',
  }
})
