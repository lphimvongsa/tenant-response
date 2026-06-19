import twilio from 'twilio'
import { NextRequest } from 'next/server'
import { twilioClient } from '@/lib/twilio'

const CANNED_REPLY =
  "Thanks for reaching out! We've received your message and a team member will be in touch shortly."

// Phase 1: single hardcoded client mapped to the configured Twilio number.
// Phase 2 will resolve client_id dynamically from the `clients` table.
function resolveClient(toNumber: string) {
  const configuredNumber = process.env.TWILIO_PHONE_NUMBER
  if (toNumber === configuredNumber) {
    return { clientId: 'client_phase1', name: 'Demo Property Management' }
  }
  return null
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

  const { From, To, Body } = params

  const client = resolveClient(To)
  if (!client) {
    console.error(`Inbound message to unrecognised number: ${To}`)
    return emptyTwiML
  }

  console.log(`[${client.clientId}] Inbound from ${From}: ${Body}`)

  try {
    await twilioClient.messages.create({ body: CANNED_REPLY, from: To, to: From })
    console.log(`[${client.clientId}] Replied to ${From}`)
  } catch (err) {
    console.error(`[${client.clientId}] Failed to send reply to ${From}:`, err)
  }

  return emptyTwiML
}
