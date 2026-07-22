import { supabase } from './integrations/supabase'
import { twilioClient } from './integrations/twilio'
import { sendPush, type PushPayload } from './integrations/push'
import type { NotificationEvent, NotificationPrefs } from './notification-events'

type ManagerRow = {
  id: string
  phone: string | null
  notification_prefs: NotificationPrefs
}

type NotifyManagersOpts = {
  clientId: string
  event: NotificationEvent
  payload: PushPayload
  // Excluded from notification — e.g. the manager who manually triggered
  // the event themselves (manual escalation) shouldn't be alerted about it.
  excludeManagerId?: string
}

// Single entry point for every notification-worthy event (new inbound
// message, maintenance ticket created, conversation escalated, EOD digest).
// Looks up each manager's per-event push/SMS preference and dispatches
// accordingly. Never throws — a failed push or SMS must never break the
// business flow (ticket creation, escalation, message send) that triggered
// it; failures are logged and swallowed, same as the existing
// sendAndStore() pattern in app/api/twilio/route.ts.
export async function notifyManagers(opts: NotifyManagersOpts): Promise<void> {
  const { clientId, event, payload, excludeManagerId } = opts

  const [{ data: managers, error: managersError }, { data: client, error: clientError }] =
    await Promise.all([
      supabase
        .from('managers')
        .select('id, phone, notification_prefs')
        .eq('client_id', clientId),
      supabase.from('clients').select('twilio_number').eq('id', clientId).single(),
    ])

  if (managersError || !managers) {
    console.error(`notifyManagers: failed to load managers for client ${clientId}:`, managersError)
    return
  }
  if (clientError || !client) {
    console.error(`notifyManagers: failed to load client ${clientId}:`, clientError)
    return
  }

  const recipients = (managers as ManagerRow[]).filter((m) => m.id !== excludeManagerId)

  const sends = recipients.flatMap((manager) => {
    const prefs = manager.notification_prefs?.[event]
    if (!prefs) return []

    const tasks: Promise<void>[] = []
    if (prefs.push) tasks.push(sendPushToManager(manager.id, payload))
    if (prefs.sms && manager.phone) {
      tasks.push(sendSmsToManager(client.twilio_number, manager.phone, payload))
    }
    return tasks
  })

  await Promise.allSettled(sends)
}

async function sendPushToManager(managerId: string, payload: PushPayload): Promise<void> {
  const { data: subscriptions, error } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('manager_id', managerId)

  if (error || !subscriptions) {
    console.error(`notifyManagers: failed to load push subscriptions for manager ${managerId}:`, error)
    return
  }

  await Promise.allSettled(subscriptions.map((sub) => sendPush(sub, payload)))
}

async function sendSmsToManager(fromNumber: string, toPhone: string, payload: PushPayload): Promise<void> {
  try {
    await twilioClient.messages.create({
      body: `${payload.title}: ${payload.body}`,
      from: fromNumber,
      to: toPhone,
    })
  } catch (err) {
    console.error(`notifyManagers: failed to send notification SMS to ${toPhone}:`, err)
  }
}
