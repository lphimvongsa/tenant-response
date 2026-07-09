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

  let body: { name?: string; phone?: string; unit_id?: string | null }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const updates: Record<string, string | null> = {}
  if (body.phone?.trim()) updates.phone = body.phone.trim()
  if ('name' in body) updates.name = body.name?.trim() || null
  if ('unit_id' in body) updates.unit_id = body.unit_id || null

  if (updates.unit_id) {
    const { data: unit, error: unitError } = await supabase
      .from('units')
      .select('id')
      .eq('id', updates.unit_id)
      .eq('client_id', manager.clientId)
      .single()

    if (unitError || !unit) {
      return new Response(JSON.stringify({ error: 'Unit not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      })
    }
  }

  if (Object.keys(updates).length === 0) {
    return new Response(JSON.stringify({ error: 'Nothing to update' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { data, error } = await supabase
    .from('tenants')
    .update(updates)
    .eq('id', id)
    .eq('client_id', manager.clientId)
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return new Response(JSON.stringify({ error: 'A tenant with this phone number already exists' }), {
        status: 409,
        headers: { 'Content-Type': 'application/json' },
      })
    }
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
    .from('tenants')
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
