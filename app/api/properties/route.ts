import { revalidateTag } from 'next/cache'
import { supabase } from '@/lib/integrations/supabase'
import { getCurrentManager } from '@/lib/integrations/supabase-auth'
import { PROPERTIES_TAG } from '@/lib/cache-tags'
import type { NextRequest } from 'next/server'

export async function GET() {
  const manager = await getCurrentManager()
  if (!manager) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { data, error } = await supabase
    .from('properties')
    .select(
      'id, name, address, photo_url, created_at, units(id, unit_number, tenants(id, name, phone), tickets(id, status))',
    )
    .eq('client_id', manager.clientId)
    .order('name', { ascending: true })

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

export async function POST(request: NextRequest) {
  const manager = await getCurrentManager()
  if (!manager) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: {
    name: string
    address: string
    city: string
    state: string
    country: string
    zip: string
  }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { name, address, city, state, country, zip } = body

  if (
    !name?.trim() ||
    !address?.trim() ||
    !city?.trim() ||
    !state?.trim() ||
    !country?.trim() ||
    !zip?.trim()
  ) {
    return new Response(
      JSON.stringify({ error: 'name, address, city, state, country, and zip are required' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const { data, error } = await supabase
    .from('properties')
    .insert({
      client_id: manager.clientId,
      name: name.trim(),
      address: address.trim(),
      city: city.trim(),
      state: state.trim(),
      country: country.trim(),
      zip: zip.trim(),
    })
    .select()
    .single()

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  revalidateTag(PROPERTIES_TAG, { expire: 0 })

  return new Response(JSON.stringify(data), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  })
}
