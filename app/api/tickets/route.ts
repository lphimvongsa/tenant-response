import { revalidateTag } from 'next/cache'
import { supabase } from '@/lib/integrations/supabase'
import { getCurrentManager } from '@/lib/integrations/supabase-auth'
import { isMaintenanceCategory } from '@/lib/maintenance-categories'
import { TICKETS_TAG, PROPERTIES_TAG } from '@/lib/cache-tags'
import type { NextRequest } from 'next/server'

export async function POST(request: NextRequest) {
  const manager = await getCurrentManager()
  if (!manager) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: {
    unit_id: string
    title: string
    category?: string
    severity?: 'mild' | 'moderate' | 'severe' | null
    location?: string | null
    description: string
    assigned_to?: string | null
    status?: string
  }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { unit_id, title, category, severity, location, description, assigned_to, status } = body

  if (!unit_id || !title?.trim() || !description?.trim()) {
    return new Response(JSON.stringify({ error: 'unit_id, title, and description are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const normalizedCategory = category?.trim().toLowerCase() || null
  if (normalizedCategory && !isMaintenanceCategory(normalizedCategory)) {
    return new Response(JSON.stringify({ error: 'Invalid category' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Confirm the unit belongs to the caller's client before inserting under it
  const { data: unit, error: unitError } = await supabase
    .from('units')
    .select('client_id')
    .eq('id', unit_id)
    .eq('client_id', manager.clientId)
    .single()

  if (unitError || !unit) {
    return new Response(JSON.stringify({ error: 'Unit not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { data, error } = await supabase
    .from('tickets')
    .insert({
      client_id: manager.clientId,
      unit_id,
      title: title.trim(),
      category: normalizedCategory,
      severity: severity ?? null,
      location: location?.trim() || null,
      description: description.trim(),
      assigned_to: assigned_to?.trim() || null,
      status: status?.trim() || 'open',
    })
    .select()
    .single()

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  revalidateTag(TICKETS_TAG, { expire: 0 })
  revalidateTag(PROPERTIES_TAG, { expire: 0 })

  return new Response(JSON.stringify(data), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  })
}
