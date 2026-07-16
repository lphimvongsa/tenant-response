import { revalidateTag } from 'next/cache'
import { supabase } from '@/lib/integrations/supabase'
import { getCurrentManager } from '@/lib/integrations/supabase-auth'
import { CONVERSATIONS_TAG } from '@/lib/cache-tags'
import type { NextRequest } from 'next/server'

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const manager = await getCurrentManager()
  if (!manager) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { error } = await supabase
    .from('messages')
    .update({ is_read: true })
    .eq('conversation_id', id)
    .eq('client_id', manager.clientId)
    .eq('direction', 'inbound')
    .eq('is_read', false)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  revalidateTag(CONVERSATIONS_TAG, { expire: 0 })

  return new Response(null, { status: 204 })
}
