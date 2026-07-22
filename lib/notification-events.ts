// Pure types + constants shared by both server code (lib/notifications.ts,
// the dispatcher) and client code (components/settings/NotificationsPanel.tsx,
// the preference matrix UI). Deliberately has zero imports of its own —
// lib/notifications.ts pulls in `web-push` and `twilio`, which resolve to
// Node-only built-ins (tls, net) that break the client bundle if a client
// component imports anything at runtime from that module. Client code must
// import event/pref types and constants from here, never from
// lib/notifications.ts directly.

export type NotificationEvent = 'message' | 'ticket_created' | 'escalation' | 'digest'

export const NOTIFICATION_EVENTS: NotificationEvent[] = [
  'message',
  'ticket_created',
  'escalation',
  'digest',
]

export type ChannelPrefs = { push: boolean; sms: boolean }
export type NotificationPrefs = Partial<Record<NotificationEvent, ChannelPrefs>>
