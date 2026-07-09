import { supabase } from '@/lib/integrations/supabase'
import { getCurrentManager } from '@/lib/integrations/supabase-auth'
import type { NextRequest } from 'next/server'

export async function PATCH(
  request: NextRequest,
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

  let is_read: boolean
  try {
    const json = await request.json()
    if (typeof json?.is_read !== 'boolean') throw new Error()
    is_read = json.is_read
  } catch {
    return new Response(JSON.stringify({ error: 'Body must be { is_read: boolean }' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { error } = await supabase
    .from('messages')
    .update({ is_read })
    .eq('id', id)
    .eq('client_id', manager.clientId)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(null, { status: 204 })
}
