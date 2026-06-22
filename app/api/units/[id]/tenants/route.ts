import { supabase } from '@/lib/integrations/supabase'
import type { NextRequest } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: unit_id } = await params

  let body: { phone: string; name?: string }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!body.phone?.trim()) {
    return new Response(JSON.stringify({ error: 'phone is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Inherit client_id from the unit
  const { data: unit, error: unitError } = await supabase
    .from('units')
    .select('client_id')
    .eq('id', unit_id)
    .single()

  if (unitError || !unit) {
    return new Response(JSON.stringify({ error: 'Unit not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { data, error } = await supabase
    .from('tenants')
    .insert({
      client_id: unit.client_id,
      unit_id,
      phone: body.phone.trim(),
      name: body.name?.trim() || null,
    })
    .select()
    .single()

  if (error) {
    // Unique constraint: phone already exists for this client
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
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  })
}
