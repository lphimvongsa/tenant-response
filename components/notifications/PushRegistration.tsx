'use client'

import { useState } from 'react'
import { usePushSubscription } from '@/lib/hooks/usePushSubscription'

// Mounted once in app/dashboard/layout.tsx. Shows a small dismissible nudge
// until the manager has either subscribed to push or explicitly dismissed
// it — dismissal is in-memory only (persists across dashboard navigation,
// since the layout doesn't remount, but resets on a fresh page load) so it
// doesn't nag every single visit but also doesn't require new schema just
// to remember a UI dismissal.
export default function PushRegistration() {
  const { status, enable } = usePushSubscription()
  const [dismissed, setDismissed] = useState(false)

  if (dismissed || status === 'unsupported' || status === 'subscribed') return null

  const message =
    status === 'not-standalone'
      ? 'Add TenaTimmy to your home screen to enable notifications.'
      : status === 'denied'
        ? 'Notifications are blocked — enable them in your device settings to get alerts.'
        : 'Enable notifications to get alerted about new messages, tickets, and escalations.'

  return (
    <div className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm font-medium [background:var(--color-ink)] [color:white]">
      <p className="min-w-0 flex-1">{message}</p>
      <div className="flex shrink-0 items-center gap-3">
        {status === 'prompt' && (
          <button
            type="button"
            onClick={enable}
            className="rounded-[var(--radius-sm)] bg-white px-3 py-1 text-sm font-semibold [color:var(--color-ink)]"
          >
            Enable
          </button>
        )}
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="text-sm font-medium opacity-80 hover:opacity-100"
        >
          Dismiss
        </button>
      </div>
    </div>
  )
}
