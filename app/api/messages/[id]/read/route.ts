import { supabase } from '@/lib/integrations/supabase'
import type { NextRequest } from 'next/server'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

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

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(null, { status: 204 })
}
