import type { SettingsActionState } from '@/app/dashboard/settings/actions'
import FeedbackBanner from './FeedbackBanner'

interface NotificationsPanelProps {
  formId: string
  notifyEmail: boolean
  notifySms: boolean
  state: SettingsActionState
  formAction: (formData: FormData) => void
}

function ToggleRow({
  name,
  defaultChecked,
  title,
  description,
}: {
  name: string
  defaultChecked: boolean
  title: string
  description: string
}) {
  return (
    <div className="flex items-center justify-between gap-6 py-4">
      <div className="min-w-0">
        <p className="text-sm font-semibold [color:var(--color-text-primary)]">{title}</p>
        <p className="mt-0.5 text-sm [color:var(--color-text-secondary)]">{description}</p>
      </div>
      <label className="relative inline-flex shrink-0 cursor-pointer items-center">
        <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
        <div className="relative h-6 w-11 rounded-full transition-colors [background:var(--color-input-border)] after:absolute after:left-[3px] after:top-[3px] after:h-[18px] after:w-[18px] after:rounded-full after:bg-white after:shadow-sm after:transition-transform after:content-[''] peer-checked:[background:var(--color-ink)] peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-[var(--color-ink)]" />
      </label>
    </div>
  )
}

export default function NotificationsPanel({
  formId,
  notifyEmail,
  notifySms,
  state,
  formAction,
}: NotificationsPanelProps) {
  return (
    <form id={formId} action={formAction} className="flex flex-col">
      {state && (
        <div className="mb-2">
          <FeedbackBanner state={state} />
        </div>
      )}

      <ToggleRow
        name="notifyEmail"
        defaultChecked={notifyEmail}
        title="Email notifications"
        description="Receive an email when tenants send new messages."
      />

      <div className="h-px [background:var(--color-border-subtle)]" />

      <ToggleRow
        name="notifySms"
        defaultChecked={notifySms}
        title="SMS notifications"
        description="Receive a text message for urgent tenant activity."
      />
    </form>
  )
}
