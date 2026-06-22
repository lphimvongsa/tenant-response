import { supabase } from '@/lib/supabase-server'
import { twilioClient } from '@/lib/twilio'
import type { NextRequest } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

  // Fetch conversation with tenant phone and ai_enabled flag
  const { data: conversation } = await supabase
    .from('conversations')
    .select('id, client_id, ai_enabled, tenants(phone)')
    .eq('id', id)
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

  // Send SMS via Twilio and capture the SID for deduplication
  let twilioSid: string
  try {
    const outbound = await twilioClient.messages.create({
      body: body,
      from: client.twilio_number,
      to: (conversation.tenants as { phone: string }).phone,
    })
    twilioSid = outbound.sid
  } catch {
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

  return new Response(JSON.stringify(message), {
    status: 201,
    headers: { 'Content-Type': 'application/json' },
  })
}
