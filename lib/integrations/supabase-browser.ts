import { createClient } from '@supabase/supabase-js'

// Browser-only Supabase client using the anon key.
// Used exclusively for Realtime subscriptions in client components.
// Server-side data fetching must use lib/integrations/supabase.ts (service key).
export const supabaseBrowser = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
)
