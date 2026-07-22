'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

// iOS Web Push only works inside an installed, standalone home-screen PWA —
// never in a regular Safari tab. `unsupported` covers both "this browser
// has no Push API at all" and "no VAPID key configured".
export type PushStatus = 'unsupported' | 'not-standalone' | 'prompt' | 'subscribed' | 'denied'

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i)
  }
  return output
}

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  )
}

// Synchronously derivable status (capability + permission + install state).
// Uses useSyncExternalStore rather than useEffect+setState — same
// isomorphic-safe pattern as lib/hooks/useIsMobile.ts — since these values
// need SSR-unsafe browser globals (window/Notification) that a client
// component's server-rendered pass can't touch, but ARE cheap to compute
// synchronously once on the client. There's no browser event for
// "permission changed" or "installed to home screen" mid-session, so
// `subscribe` is a no-op; recomputation happens on the next render instead
// (see the `bump` trick in `enable` below).
function computeCapabilityStatus(): Exclude<PushStatus, 'subscribed'> {
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (
    !vapidKey ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window) ||
    !('Notification' in window)
  ) {
    return 'unsupported'
  }
  if (!isStandalone()) return 'not-standalone'
  if (Notification.permission === 'denied') return 'denied'
  return 'prompt'
}

function noopSubscribe() {
  return () => {}
}

function getServerSnapshot(): Exclude<PushStatus, 'subscribed'> {
  return 'unsupported'
}

// Shared by the dashboard-wide nudge banner (components/notifications/PushRegistration.tsx)
// and the Notification Preferences tab's status row — both need the same
// status + subscribe action, just with different surrounding UI.
export function usePushSubscription() {
  const capabilityStatus = useSyncExternalStore(noopSubscribe, computeCapabilityStatus, getServerSnapshot)
  const [hasSubscription, setHasSubscription] = useState(false)
  // Bumped after enable() to force a re-render, which re-invokes
  // computeCapabilityStatus() and picks up a permission change (e.g. denied).
  const [, bump] = useState(0)

  // Only fires when capability checks passed but we don't yet know if a
  // subscription already exists on this device — setState only happens
  // inside the async .then() callback, never synchronously in the effect
  // body itself.
  useEffect(() => {
    if (capabilityStatus !== 'prompt') return
    let cancelled = false

    navigator.serviceWorker.register('/sw.js').then(async (registration) => {
      const existing = await registration.pushManager.getSubscription()
      if (!cancelled && existing) setHasSubscription(true)
    })

    return () => {
      cancelled = true
    }
  }, [capabilityStatus])

  const status: PushStatus =
    capabilityStatus === 'prompt' && hasSubscription ? 'subscribed' : capabilityStatus

  // Must be called directly from a user-gesture click handler —
  // Notification.requestPermission() silently no-ops on iOS Safari
  // otherwise.
  const enable = useCallback(async () => {
    const permission = await Notification.requestPermission()
    bump((v) => v + 1)
    if (permission !== 'granted') return

    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!),
    })

    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subscription.toJSON()),
    })

    setHasSubscription(true)
  }, [])

  return { status, enable }
}
