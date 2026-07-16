import { revalidateTag } from 'next/cache'
import { supabase } from '@/lib/integrations/supabase'
import { getCurrentManager } from '@/lib/integrations/supabase-auth'
import { twilioClient } from '@/lib/integrations/twilio'
import { CONVERSATIONS_TAG } from '@/lib/cache-tags'
import type { NextRequest } from 'next/server'

export async function POST(
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

  // Parse and validate body
  let body: string
  try {
    const json = await request.json()
    body = json?.body
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!body || typeof body !== 'string' || body.trim() === '') {
    return new Response(JSON.stringify({ error: 'body must be a non-empty string' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Fetch conversation with tenant phone and ai_enabled flag — scoped to the
  // caller's client so a guessed/enumerated conversation id from another
  // tenant can't be read or sent to.
  const { data: conversation } = await supabase
    .from('conversations')
    .select('id, client_id, ai_enabled, tenants(phone)')
    .eq('id', id)
    .eq('client_id', manager.clientId)
    .single()

  if (!conversation) {
    return new Response(JSON.stringify({ error: 'Conversation not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Fetch client's twilio_number
  const { data: client } = await supabase
    .from('clients')
    .select('twilio_number')
    .eq('id', conversation.client_id)
    .single()

  if (!client) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Supabase returns the FK-joined tenant as a single object (not an array)
  const tenantPhone = (conversation.tenants as unknown as { phone: string } | null)?.phone
  if (!tenantPhone) {
    return new Response(JSON.stringify({ error: 'Tenant phone not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Send SMS via Twilio and capture the SID for deduplication
  let twilioSid: string
  try {
    const outbound = await twilioClient.messages.create({
      body: body,
      from: client.twilio_number,
      to: tenantPhone,
    })
    twilioSid = outbound.sid
  } catch (err) {
    console.error('Failed to send SMS via Twilio:', err)
    return new Response(JSON.stringify({ error: 'Failed to send SMS' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Insert outbound message record
  const { data: message, error: insertError } = await supabase
    .from('messages')
    .insert({
      client_id: conversation.client_id,
      conversation_id: id,
      direction: 'outbound',
      body: body,
      twilio_sid: twilioSid,
      sender_type: 'human',
      ai_generated: false,
      status: 'sent',
    })
    .select()
    .single()

  if (insertError || !message) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  revalidateTag(CONVERSATIONS_TAG, { expire: 0 })

  return new Response(JSON.stringify(message), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  })
}

export async function GET(
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
  const cursor = new URL(request.url).searchParams.get('cursor')

  // Scoped to the caller's client so a guessed/enumerated conversation id
  // from another tenant can't be read.
  const { data: conversation } = await supabase
    .from('conversations')
    .select('id')
    .eq('id', id)
    .eq('client_id', manager.clientId)
    .single()

  if (!conversation) {
    return new Response(JSON.stringify({ error: 'Conversation not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Over-fetch by one row to detect hasMore without a second round trip.
  let query = supabase
    .from('messages')
    .select('id, direction, body, created_at, is_read')
    .eq('conversation_id', id)
    .order('created_at', { ascending: false })
    .limit(11)

  if (cursor) {
    query = query.lt('created_at', cursor)
  }

  const { data, error } = await query

  if (error) {
    console.error('Failed to fetch messages:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const hasMore = (data?.length ?? 0) === 11
  const messages = (data ?? []).slice(0, 10).reverse()

  return new Response(JSON.stringify({ messages, hasMore }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
