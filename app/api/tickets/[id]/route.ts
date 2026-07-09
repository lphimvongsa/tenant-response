import { supabase } from '@/lib/integrations/supabase'
import { getCurrentManager } from '@/lib/integrations/supabase-auth'
import type { NextRequest } from 'next/server'

const VALID_STATUSES = ['open', 'in_progress', 'in_review', 'resolved', 'closed']

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

  let body: { status?: string; assigned_to?: string | null }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (body.status !== undefined && !VALID_STATUSES.includes(body.status)) {
    return new Response(JSON.stringify({ error: 'Invalid status' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (body.status === undefined && body.assigned_to === undefined) {
    return new Response(JSON.stringify({ error: 'No fields to update' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Confirm the ticket belongs to the caller's client before updating it
  const { data: ticket, error: ticketError } = await supabase
    .from('tickets')
    .select('id, client_id')
    .eq('id', id)
    .eq('client_id', manager.clientId)
    .single()

  if (ticketError || !ticket) {
    return new Response(JSON.stringify({ error: 'Ticket not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const updates: Record<string, string | null> = {}
  if (body.status !== undefined) updates.status = body.status
  if (body.assigned_to !== undefined) updates.assigned_to = body.assigned_to?.trim() || null

  const { data, error } = await supabase
    .from('tickets')
    .update(updates)
    .eq('id', id)
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
