import { revalidateTag } from 'next/cache'
import { supabase } from '@/lib/integrations/supabase'
import { getCurrentManager } from '@/lib/integrations/supabase-auth'
import { notifyManagers } from '@/lib/notifications'
import { CONVERSATIONS_TAG } from '@/lib/cache-tags'
import type { NextRequest } from 'next/server'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const manager = await getCurrentManager()
  if (!manager) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { id } = await params

  // Scoped to the caller's client so a guessed/enumerated conversation id
  // from another tenant can't be read or escalated.
  const { data: conversation } = await supabase
    .from('conversations')
    .select('id')
    .eq('id', id)
    .eq('client_id', manager.clientId)
    .single()

  if (!conversation) {
    return new Response(JSON.stringify({ error: 'Conversation not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { data: updated, error } = await supabase
    .from('conversations')
    .update({ status: 'escalated' })
    .eq('id', id)
    .select('id, status')
    .single()

  if (error || !updated) {
    console.error('Failed to escalate conversation:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  revalidateTag(CONVERSATIONS_TAG, { expire: 0 })

  // Exclude the acting manager — they already know, they just did it.
  await notifyManagers({
    clientId: manager.clientId,
    event: 'escalation',
    payload: {
      title: 'Conversation escalated',
      body: 'A teammate escalated a conversation. Check the dashboard.',
      url: `/dashboard/conversations/${id}`,
    },
    excludeManagerId: manager.managerId,
  })

  return new Response(JSON.stringify(updated), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
