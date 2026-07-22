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
        className="rounded-[var(--radius-sm)] border px-3 py-2 text-sm font-medium [background:rgba(214,69,69,0.16)] [border-color:rgba(255,180,180,0.4)] [color:#ffb4b4]"
      >
        {state.message}
      </p>
    )
  }

  return (
    <p
      role="status"
      className="rounded-[var(--radius-sm)] border px-3 py-2 text-sm font-medium [background:rgba(30,158,108,0.16)] [border-color:rgba(110,231,183,0.38)] [color:#6ee7b7]"
    >
      {state.message}
    </p>
  )
}
