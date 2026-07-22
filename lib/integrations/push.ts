import webpush from 'web-push'
import { supabase } from './supabase'

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!,
)

export type PushSubscriptionRow = {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

export type PushPayload = {
  title: string
  body: string
  url: string
}

// Sends one Web Push message to one subscription. A 404/410 response means
// the subscription is gone (browser revoked it, user uninstalled the PWA,
// etc.) — clean up the row rather than retrying it forever.
export async function sendPush(
  subscription: PushSubscriptionRow,
  payload: PushPayload,
): Promise<void> {
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload),
    )
  } catch (err) {
    const statusCode = (err as { statusCode?: number }).statusCode
    if (statusCode === 404 || statusCode === 410) {
      await supabase.from('push_subscriptions').delete().eq('id', subscription.id)
      return
    }
    console.error(`Failed to send push to subscription ${subscription.id}:`, err)
  }
}
