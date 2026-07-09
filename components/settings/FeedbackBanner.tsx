import type { SettingsActionState } from '@/app/dashboard/settings/actions'

// Renders a success or error message from a Settings server action result.
// Renders nothing before the first submission (state === undefined).
export default function FeedbackBanner({ state }: { state: SettingsActionState }) {
  if (!state) {
    return null
  }

  if (state.status === 'error') {
    return (
      <p
        role="alert"
        className="rounded-[var(--radius-sm)] px-3 py-2 text-sm font-medium [background:var(--color-danger-bg)] [color:var(--color-danger)]"
      >
        {state.message}
      </p>
    )
  }

  return (
    <p
      role="status"
      className="rounded-[var(--radius-sm)] px-3 py-2 text-sm font-medium [background:var(--color-success-bg)] [color:var(--color-success)]"
    >
      {state.message}
    </p>
  )
}
