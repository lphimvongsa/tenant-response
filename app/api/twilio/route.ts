import twilio from 'twilio'
import { NextRequest } from 'next/server'
import { twilioClient } from '@/lib/twilio'
import { supabase } from '@/lib/supabase-server'

const CANNED_REPLY =
  "Thanks for reaching out! We've received your message and a team member will be in touch shortly."

async function resolveClient(toNumber: string) {
  const { data, error } = await supabase
    .from('clients')
    .select('id, name')
    .eq('twilio_number', toNumber)
    .eq('active', true)
    .single()
  if (error || !data) return null
  return data
}

const emptyTwiML = new Response('<Response/>', {
  headers: { 'Content-Type': 'text/xml' },
})

export async function POST(request: NextRequest) {
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const webhookUrl = process.env.TWILIO_WEBHOOK_URL

  if (!authToken || !webhookUrl) {
    console.error('Missing TWILIO_AUTH_TOKEN or TWILIO_WEBHOOK_URL')
    return new Response('Server misconfiguration', { status: 500 })
  }

  const signature = request.headers.get('x-twilio-signature')
  if (!signature) {
    return new Response('Forbidden', { status: 403 })
  }

  // Twilio sends application/x-www-form-urlencoded; read raw text for signature validation
  const body = await request.text()
  const params = Object.fromEntries(new URLSearchParams(body))

  const isValid = twilio.validateRequest(authToken, signature, webhookUrl, params)
  if (!isValid) {
    console.warn('Invalid Twilio signature — request rejected')
    return new Response('Forbidden', { status: 403 })
  }

  const { From, To, Body, MessageSid } = params

  const client = await resolveClient(To)
  if (!client) {
    console.error(`Inbound message to unrecognised number: ${To}`)
    return emptyTwiML
  }

  console.log(`[${client.id}] Inbound from ${From}`)

  // Upsert tenant by phone + client (unique per client since migration 004)
  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .upsert(
      { client_id: client.id, phone: From },
      { onConflict: 'phone,client_id' },
    )
    .select('id')
    .single()

  if (tenantError || !tenant) {
    console.error('Failed to upsert tenant:', tenantError)
    return emptyTwiML
  }

  // Find existing active conversation or create one
  const { data: existingConv } = await supabase
    .from('conversations')
    .select('id')
    .eq('tenant_id', tenant.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let conversationId = existingConv?.id
  if (!conversationId) {
    const { data: newConv, error: convError } = await supabase
      .from('conversations')
      .insert({ client_id: client.id, tenant_id: tenant.id })
      .select('id')
      .single()
    if (convError || !newConv) {
      console.error('Failed to create conversation:', convError)
      return emptyTwiML
    }
    conversationId = newConv.id
  }

  // Insert inbound message — twilio_sid deduplicates webhook retries
  const { error: msgError } = await supabase
    .from('messages')
    .insert({
      client_id: client.id,
      conversation_id: conversationId,
      direction: 'inbound',
      body: Body,
      twilio_sid: MessageSid,
      sender_type: 'human',
      ai_generated: false,
    })

  if (msgError) {
    // Unique violation on twilio_sid means this is a duplicate webhook delivery
    if (msgError.code === '23505') {
      console.warn(`[${client.id}] Duplicate webhook for ${MessageSid} — skipping`)
      return emptyTwiML
    }
    console.error('Failed to insert inbound message:', msgError)
    // still attempt to send canned reply
  }

  try {
    const outbound = await twilioClient.messages.create({
      body: CANNED_REPLY,
      from: To,
      to: From,
    })
    console.log(`[${client.id}] Replied to ${From}`)
    await supabase.from('messages').insert({
      client_id: client.id,
      conversation_id: conversationId,
      direction: 'outbound',
      body: CANNED_REPLY,
      twilio_sid: outbound.sid,
      sender_type: 'system',
      ai_generated: false,
      status: 'sent',
    })
  } catch (err) {
    console.error(`[${client.id}] Failed to send reply to ${From}:`, err)
  }

  return emptyTwiML
}
