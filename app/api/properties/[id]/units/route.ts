import { supabase } from '@/lib/integrations/supabase'
import { getCurrentManager } from '@/lib/integrations/supabase-auth'
import type { NextRequest } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: property_id } = await params

  const manager = await getCurrentManager()
  if (!manager) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: { unit_number: string }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!body.unit_number?.trim()) {
    return new Response(JSON.stringify({ error: 'unit_number is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Inherit client_id from the property
  const { data: property, error: propError } = await supabase
    .from('properties')
    .select('client_id')
    .eq('id', property_id)
    .eq('client_id', manager.clientId)
    .single()

  if (propError || !property) {
    return new Response(JSON.stringify({ error: 'Property not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { data, error } = await supabase
    .from('units')
    .insert({
      client_id: property.client_id,
      property_id,
      unit_number: body.unit_number.trim(),
    })
    .select()
    .single()

  if (error) {
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
