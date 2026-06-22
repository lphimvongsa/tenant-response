import { createClient } from '@supabase/supabase-js'

// Service role key bypasses RLS — use only in server-side code (API routes), never expose to clients
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!,
)
