import { supabase } from '@/lib/integrations/supabase'
import { getCurrentManager } from '@/lib/integrations/supabase-auth'
import type { NextRequest } from 'next/server'

// Saves (or reassigns, if the same endpoint re-subscribes under a different
// logged-in manager on a shared device) a browser's Web Push subscription
// for the current manager. Called by components/notifications/PushRegistration.tsx
// right after a successful `pushManager.subscribe()`.
export async function POST(request: NextRequest) {
  const manager = await getCurrentManager()
  if (!manager) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const body = await request.json().catch(() => null)
  const endpoint = body?.endpoint
  const p256dh = body?.keys?.p256dh
  const auth = body?.keys?.auth

  if (typeof endpoint !== 'string' || typeof p256dh !== 'string' || typeof auth !== 'string') {
    return new Response(JSON.stringify({ error: 'Invalid subscription payload' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      manager_id: manager.managerId,
      endpoint,
      p256dh,
      auth,
      user_agent: request.headers.get('user-agent'),
    },
    { onConflict: 'endpoint' },
  )

  if (error) {
    console.error('push/subscribe: failed to save subscription:', error)
    return new Response(JSON.stringify({ error: 'Failed to save subscription' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
