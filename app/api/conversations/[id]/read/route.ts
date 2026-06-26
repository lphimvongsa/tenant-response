import { supabase } from '@/lib/integrations/supabase'
import type { NextRequest } from 'next/server'

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  const { error } = await supabase
    .from('messages')
    .update({ is_read: true })
    .eq('conversation_id', id)
    .eq('direction', 'inbound')
    .eq('is_read', false)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(null, { status: 204 })
}
