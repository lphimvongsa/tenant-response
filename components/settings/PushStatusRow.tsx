'use client'

import { usePushSubscription } from '@/lib/hooks/usePushSubscription'

// Status/enable control at the top of the Notification Preferences tab —
// the per-event push toggles below are moot until push is actually enabled
// on this device, so this makes that prerequisite visible instead of
// leaving staff to wonder why toggling "push" for an event does nothing.
export default function PushStatusRow() {
  const { status, enable } = usePushSubscription()

  const label =
    status === 'subscribed'
      ? 'Push notifications are enabled on this device.'
      : status === 'not-standalone'
        ? 'Add TenaTimmy to your home screen to enable push notifications.'
        : status === 'denied'
          ? 'Notifications are blocked for this device — check your device settings.'
          : status === 'unsupported'
            ? "Push notifications aren't supported in this browser."
            : 'Push notifications are not yet enabled on this device.'

  return (
    <div className="glass-chip flex items-center justify-between gap-4 rounded-[var(--radius-sm)] px-3 py-2.5">
      <p className="text-sm [color:var(--color-on-glass-muted)]">{label}</p>
      {status === 'prompt' && (
        <button
          type="button"
          onClick={enable}
          className="shrink-0 rounded-[var(--radius-sm)] px-3 py-1.5 text-sm font-semibold transition-colors [background:var(--color-lavender-300)] [color:var(--color-ink)] hover:[background:var(--color-lavender-200)]"
        >
          Enable
        </button>
      )}
    </div>
  )
}
