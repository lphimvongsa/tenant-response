import type { SettingsActionState } from '@/app/dashboard/settings/actions'
import { NOTIFICATION_EVENTS, type NotificationEvent, type NotificationPrefs } from '@/lib/notification-events'
import FeedbackBanner from './FeedbackBanner'
import PushStatusRow from './PushStatusRow'

interface NotificationsPanelProps {
  formId: string
  notifyEmail: boolean
  notificationPrefs: NotificationPrefs
  state: SettingsActionState
  formAction: (formData: FormData) => void
}

const EVENT_LABELS: Record<NotificationEvent, { title: string; description: string }> = {
  message: {
    title: 'New messages',
    description: 'A tenant sends a message (and the AI reply, if any).',
  },
  ticket_created: {
    title: 'Maintenance tickets',
    description: 'A new maintenance ticket is created.',
  },
  escalation: {
    title: 'Escalations',
    description: 'A conversation is escalated, automatically or by a teammate.',
  },
  digest: {
    title: 'Daily digest',
    description: 'A recap of unread conversations at the end of your business day.',
  },
}

function Toggle({ name, defaultChecked }: { name: string; defaultChecked: boolean }) {
  return (
    <label className="relative inline-flex shrink-0 cursor-pointer items-center">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="peer sr-only" />
      <div className="relative h-6 w-11 rounded-full transition-colors [background:var(--color-input-border)] after:absolute after:left-[3px] after:top-[3px] after:h-[18px] after:w-[18px] after:rounded-full after:bg-white after:shadow-sm after:transition-transform after:content-[''] peer-checked:[background:var(--color-ink)] peer-checked:after:translate-x-5 peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-[var(--color-ink)]" />
    </label>
  )
}

export default function NotificationsPanel({
  formId,
  notifyEmail,
  notificationPrefs,
  state,
  formAction,
}: NotificationsPanelProps) {
  return (
    <form id={formId} action={formAction} className="flex flex-col gap-4">
      {state && <FeedbackBanner state={state} />}

      <PushStatusRow />

      <div>
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 gap-y-1 pb-1 text-xs font-semibold uppercase tracking-wide [color:var(--color-text-secondary)]">
          <span />
          <span className="text-center">Push</span>
          <span className="text-center">SMS</span>
        </div>

        {NOTIFICATION_EVENTS.map((event) => {
          const prefs = notificationPrefs[event]
          return (
            <div
              key={event}
              className="grid grid-cols-[1fr_auto_auto] items-center gap-x-4 border-t py-3 [border-color:var(--color-border-subtle)]"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold [color:var(--color-text-primary)]">
                  {EVENT_LABELS[event].title}
                </p>
                <p className="mt-0.5 text-sm [color:var(--color-text-secondary)]">
                  {EVENT_LABELS[event].description}
                </p>
              </div>
              <div className="flex justify-center">
                <Toggle name={`${event}-push`} defaultChecked={prefs?.push ?? true} />
              </div>
              <div className="flex justify-center">
                <Toggle name={`${event}-sms`} defaultChecked={prefs?.sms ?? false} />
              </div>
            </div>
          )
        })}
      </div>

      <div className="h-px [background:var(--color-border-subtle)]" />

      <div className="flex items-center justify-between gap-6 py-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold [color:var(--color-text-primary)]">Email notifications</p>
          <p className="mt-0.5 text-sm [color:var(--color-text-secondary)]">
            Receive an email when tenants send new messages.
          </p>
        </div>
        <Toggle name="notifyEmail" defaultChecked={notifyEmail} />
      </div>
    </form>
  )
}
