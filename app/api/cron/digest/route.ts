import { supabase } from '@/lib/integrations/supabase'
import { notifyManagers } from '@/lib/notifications'
import { getLocalParts } from '@/lib/utils/time'
import type { BusinessHours } from '@/lib/utils/time'
import type { NextRequest } from 'next/server'

// Supabase pg_cron (see supabase/migrations/014_notifications.sql) hits this
// route every 15 minutes via pg_net. Each run checks every active client's
// local time against its own business_hours.end — this can't be a single
// fixed cron time since clients span timezones — and sends at most one
// digest per client per local day (last_digest_sent_on guards re-sends
// across the ~15min window it might match more than once).
const DIGEST_WINDOW_MINUTES = 15

function isWithinDigestWindow(businessHours: BusinessHours): boolean {
  const { day, minutes } = getLocalParts(businessHours.timezone)
  if (!businessHours.days.includes(day)) return false

  const [endHour, endMinute] = businessHours.end.split(':').map(Number)
  const endMinutes = endHour * 60 + endMinute
  return minutes >= endMinutes && minutes < endMinutes + DIGEST_WINDOW_MINUTES
}

async function sendDigestForClient(clientId: string, clientName: string): Promise<void> {
  const { data: unreadMessages, error } = await supabase
    .from('messages')
    .select('conversation_id')
    .eq('client_id', clientId)
    .eq('direction', 'inbound')
    .eq('is_read', false)

  if (error || !unreadMessages) {
    console.error(`cron/digest: failed to load unread messages for client ${clientId}:`, error)
    return
  }

  const unreadConversationCount = new Set(unreadMessages.map((m) => m.conversation_id)).size
  if (unreadConversationCount === 0) return

  const plural = unreadConversationCount === 1 ? '' : 's'
  await notifyManagers({
    clientId,
    event: 'digest',
    payload: {
      title: `${unreadConversationCount} unread conversation${plural}`,
      body: `${clientName}: you have ${unreadConversationCount} conversation${plural} with unread messages.`,
      url: '/dashboard',
    },
  })
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Forbidden', { status: 403 })
  }

  const { data: clients, error } = await supabase
    .from('clients')
    .select('id, name, ai_config, last_digest_sent_on')
    .eq('active', true)

  if (error || !clients) {
    console.error('cron/digest: failed to load clients:', error)
    return new Response('Internal server error', { status: 500 })
  }

  for (const client of clients) {
    const aiConfig = (client.ai_config ?? {}) as { business_hours?: BusinessHours }
    const businessHours = aiConfig.business_hours
    if (!businessHours?.timezone || !businessHours.days?.length || !businessHours.end) continue

    const { dateKey } = getLocalParts(businessHours.timezone)
    if (client.last_digest_sent_on === dateKey) continue
    if (!isWithinDigestWindow(businessHours)) continue

    await sendDigestForClient(client.id, client.name)
    await supabase.from('clients').update({ last_digest_sent_on: dateKey }).eq('id', client.id)
  }

  return new Response('OK', { status: 200 })
}
