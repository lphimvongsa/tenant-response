import { supabase } from '@/lib/integrations/supabase'
import { getCurrentManager } from '@/lib/integrations/supabase-auth'
import type { NextRequest } from 'next/server'

export async function PATCH(
  request: NextRequest,
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

  let body: { name?: string; address?: string; photo_url?: string | null }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const updates: Record<string, string | null> = {}
  if (body.name?.trim()) updates.name = body.name.trim()
  if (body.address?.trim()) updates.address = body.address.trim()
  if ('photo_url' in body) updates.photo_url = body.photo_url ?? null

  if (Object.keys(updates).length === 0) {
    return new Response(JSON.stringify({ error: 'Nothing to update' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { data, error } = await supabase
    .from('properties')
    .update(updates)
    .eq('id', id)
    .eq('client_id', manager.clientId)
    .select()
    .single()

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function DELETE(
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

  const { error } = await supabase
    .from('properties')
    .delete()
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
