import twilio from 'twilio'
import { NextRequest } from 'next/server'
import { revalidateTag } from 'next/cache'
import { twilioClient } from '@/lib/integrations/twilio'
import { supabase } from '@/lib/integrations/supabase'
import { isAfterHours } from '@/lib/utils/time'
import { runAiRouter } from '@/lib/ai/router'
import { executeFlow } from '@/lib/execute-flow'
import { CONVERSATIONS_TAG, TICKETS_TAG, PROPERTIES_TAG } from '@/lib/cache-tags'
import type { BusinessHours } from '@/lib/utils/time'

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function buildAfterHoursReply(businessHours: BusinessHours | undefined | null): string {
  const suffix =
    'Reply if you have a maintenance or rent issue and we\'ll follow up. For emergencies, please call 911.'

  if (!businessHours?.days?.length || !businessHours.start || !businessHours.end) {
    return `Our office is currently closed. ${suffix}`
  }

  const { days, start, end } = businessHours

  // Format day range: [1,2,3,4,5] → "Mon–Fri", [1,2,3,4,5,6] → "Mon–Sat"
  const sortedDays = [...days].sort((a, b) => a - b)
  const dayLabel =
    sortedDays.length > 1 &&
    sortedDays[sortedDays.length - 1] - sortedDays[0] === sortedDays.length - 1
      ? `${DAY_NAMES[sortedDays[0]]}–${DAY_NAMES[sortedDays[sortedDays.length - 1]]}`
      : sortedDays.map((d) => DAY_NAMES[d]).join(', ')

  // Format time: "09:00" → "9AM", "17:00" → "5PM", "12:00" → "12PM"
  const formatTime = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number)
    const period = h < 12 ? 'AM' : 'PM'
    const hour = h % 12 === 0 ? 12 : h % 12
    return m === 0 ? `${hour}${period}` : `${hour}:${String(m).padStart(2, '0')}${period}`
  }

  return `Our office is closed. Our hours are ${dayLabel}, ${formatTime(start)}–${formatTime(end)}. ${suffix}`
}

const emptyTwiML = new Response('<Response/>', {
  headers: { 'Content-Type': 'text/xml' },
})

// ─── MMS: download from Twilio and re-host in Supabase Storage ───────────────

async function uploadMediaToStorage(
  mediaUrl: string,
  contentType: string,
  clientId: string,
  conversationId: string,
): Promise<string | null> {
  try {
    const res = await fetch(mediaUrl, {
      headers: {
        Authorization: `Basic ${Buffer.from(
          `${process.env.TWILIO_ACCOUNT_SID}:${process.env.TWILIO_AUTH_TOKEN}`,
        ).toString('base64')}`,
      },
    })
    if (!res.ok) throw new Error(`Twilio media fetch failed: ${res.status}`)

    const buffer = Buffer.from(await res.arrayBuffer())
    const ext = contentType.split('/')[1] ?? 'jpg'
    const path = `${clientId}/${conversationId}/${Date.now()}.${ext}`

    const { error } = await supabase.storage
      .from('maintenance-photos')
      .upload(path, buffer, { contentType })

    if (error) throw error

    const { data } = supabase.storage.from('maintenance-photos').getPublicUrl(path)
    return data.publicUrl
  } catch (err) {
    console.error('Failed to upload media to storage:', err)
    return null
  }
}

// ─── Store outbound message and send via Twilio ───────────────────────────────

async function sendAndStore(opts: {
  body: string
  from: string
  to: string
  clientId: string
  conversationId: string
  senderType?: 'ai' | 'system'
}): Promise<void> {
  const { body, from, to, clientId, conversationId, senderType = 'ai' } = opts
  try {
    const msg = await twilioClient.messages.create({ body, from, to })
    await supabase.from('messages').insert({
      client_id: clientId,
      conversation_id: conversationId,
      direction: 'outbound',
      body,
      twilio_sid: msg.sid,
      sender_type: senderType,
      ai_generated: senderType === 'ai',
      status: 'sent',
    })
    revalidateTag(CONVERSATIONS_TAG, { expire: 0 })
  } catch (err) {
    console.error(`[${clientId}] Failed to send/store outbound message:`, err)
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const authToken = process.env.TWILIO_AUTH_TOKEN
  const webhookUrl = process.env.TWILIO_WEBHOOK_URL

  if (!authToken || !webhookUrl) {
    console.error('Missing TWILIO_AUTH_TOKEN or TWILIO_WEBHOOK_URL')
    return new Response('Server misconfiguration', { status: 500 })
  }

  const signature = request.headers.get('x-twilio-signature')
  if (!signature) return new Response('Forbidden', { status: 403 })

  const rawBody = await request.text()
  const params = Object.fromEntries(new URLSearchParams(rawBody))

  if (!twilio.validateRequest(authToken, signature, webhookUrl, params)) {
    console.warn('Invalid Twilio signature — rejected')
    return new Response('Forbidden', { status: 403 })
  }

  const { From, To, Body = '', MessageSid, NumMedia, MediaUrl0, MediaContentType0 } = params
  const hasMedia = parseInt(NumMedia ?? '0', 10) > 0

  // ── STAGE 1: Resolve client, tenant, conversation ──────────────────────────

  const { data: client } = await supabase
    .from('clients')
    .select('id, name, ai_config, escalation_config')
    .eq('twilio_number', To)
    .eq('active', true)
    .single()

  if (!client) {
    console.error(`No active client for number: ${To}`)
    return emptyTwiML
  }

  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .upsert({ client_id: client.id, phone: From }, { onConflict: 'phone,client_id' })
    .select('id')
    .single()

  if (tenantError || !tenant) {
    console.error('Failed to upsert tenant:', tenantError)
    return emptyTwiML
  }

  const { data: existingConv } = await supabase
    .from('conversations')
    .select('id, ai_enabled, status')
    .eq('tenant_id', tenant.id)
    .eq('client_id', client.id)
    .in('status', ['active', 'escalated'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  let conversationId: string
  let aiEnabled: boolean
  let wasEscalated = false

  if (existingConv) {
    conversationId = existingConv.id
    aiEnabled = existingConv.ai_enabled
    wasEscalated = existingConv.status === 'escalated'
  } else {
    const { data: newConv, error: convError } = await supabase
      .from('conversations')
      .insert({ client_id: client.id, tenant_id: tenant.id })
      .select('id, ai_enabled')
      .single()
    if (convError || !newConv) {
      console.error('Failed to create conversation:', convError)
      return emptyTwiML
    }
    conversationId = newConv.id
    aiEnabled = newConv.ai_enabled
  }

  // Download and re-host MMS media before inserting the message
  let uploadedPhotoUrl: string | null = null
  if (hasMedia && MediaUrl0 && MediaContentType0) {
    uploadedPhotoUrl = await uploadMediaToStorage(
      MediaUrl0,
      MediaContentType0,
      client.id,
      conversationId,
    )
  }

  // Store inbound message — twilio_sid deduplicates webhook retries
  const { error: msgError } = await supabase.from('messages').insert({
    client_id: client.id,
    conversation_id: conversationId,
    direction: 'inbound',
    body: Body,
    twilio_sid: MessageSid,
    sender_type: 'human',
    ai_generated: false,
    media_url: uploadedPhotoUrl,
  })

  if (msgError?.code === '23505') {
    // Duplicate webhook delivery — already processed
    console.warn(`[${client.id}] Duplicate webhook ${MessageSid} — skipping`)
    return emptyTwiML
  }

  // New inbound message — the cached conversations list (last message
  // preview, unread count, ordering) is now stale for this client.
  revalidateTag(CONVERSATIONS_TAG, { expire: 0 })

  // ── STAGE 2A: Guard — manager has taken over this conversation ─────────────

  if (!aiEnabled) {
    console.log(`[${client.id}] AI disabled for conversation ${conversationId}`)
    return emptyTwiML
  }

  // ── STAGE 2B: Guard — conversation escalated (emergency intent) ────────────

  if (wasEscalated) {
    console.log(`[${client.id}] Conversation ${conversationId} is escalated — skipping AI`)
    return emptyTwiML
  }

  const aiConfig = (client.ai_config ?? {}) as {
    business_hours?: BusinessHours
    rent_policy?: string
  }

  // ── STAGE 3: AI Router ─────────────────────────────────────────────────────
  // Runs regardless of business hours — we need the intent before deciding
  // whether to apply the after-hours response (only "general" is gated).

  // Load last 10 messages (oldest first) for conversation context
  const { data: history } = await supabase
    .from('messages')
    .select('direction, body, sender_type')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(10)

  const orderedHistory = (history ?? []).reverse() as {
    direction: 'inbound' | 'outbound'
    body: string
    sender_type: string
  }[]

  let routerOutput
  try {
    routerOutput = await runAiRouter({
      clientName: client.name,
      aiConfig,
      history: orderedHistory,
      inboundBody: Body,
      hasMedia,
    })
  } catch (err) {
    console.error(`[${client.id}] AI router error:`, err)
    // Fail safe: send a generic reply rather than going silent
    await sendAndStore({
      body: "We received your message and will follow up shortly.",
      from: To,
      to: From,
      clientId: client.id,
      conversationId,
      senderType: 'system',
    })
    return emptyTwiML
  }

  console.log(`[${client.id}] Intent: ${routerOutput.intent} for conversation ${conversationId}`)

  // ── STAGE 4: Execute flow side-effects ─────────────────────────────────────

  await executeFlow({
    supabase,
    clientId: client.id,
    tenantId: tenant.id,
    conversationId,
    routerOutput,
    uploadedPhotoUrl,
  })

  // executeFlow may have created/updated a maintenance ticket (surfaced on
  // both the maintenance board and the property detail page) or escalated
  // the conversation on an emergency intent — invalidate all three so staff
  // see it immediately rather than after the fallback revalidate window.
  revalidateTag(TICKETS_TAG, { expire: 0 })
  revalidateTag(PROPERTIES_TAG, { expire: 0 })
  revalidateTag(CONVERSATIONS_TAG, { expire: 0 })

  // ── STAGE 5: Send outbound response and store it ───────────────────────────
  // After-hours only suppresses "general" chit-chat — maintenance, emergency,
  // and late_rent always get a real AI response regardless of the hour.

  const afterHours = isAfterHours(aiConfig.business_hours)

  if (afterHours && routerOutput.intent === 'general') {
    console.log(`[${client.id}] After-hours general message from ${From} — sending auto-reply`)
    await sendAndStore({
      body: buildAfterHoursReply(aiConfig.business_hours),
      from: To,
      to: From,
      clientId: client.id,
      conversationId,
      senderType: 'system',
    })
    return emptyTwiML
  }

  await sendAndStore({
    body: routerOutput.responseText,
    from: To,
    to: From,
    clientId: client.id,
    conversationId,
    senderType: 'ai',
  })

  return emptyTwiML
}
