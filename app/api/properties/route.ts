import { supabase } from '@/lib/integrations/supabase'
import type { NextRequest } from 'next/server'

export async function GET() {
  const { data, error } = await supabase
    .from('properties')
    .select('id, name, address, created_at, units(id, unit_number, tenants(id, name, phone))')
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
  let body: { client_id: string; name: string; address: string }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { client_id, name, address } = body

  if (!client_id || !name?.trim() || !address?.trim()) {
    return new Response(JSON.stringify({ error: 'client_id, name, and address are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { data, error } = await supabase
    .from('properties')
    .insert({ client_id, name: name.trim(), address: address.trim() })
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
