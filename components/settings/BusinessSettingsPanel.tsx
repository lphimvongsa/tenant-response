import type { ReactNode } from 'react'
import type { SettingsActionState } from '@/app/dashboard/settings/actions'
import type { BusinessHours } from '@/lib/utils/time'
import FeedbackBanner from './FeedbackBanner'

interface BusinessSettingsPanelProps {
  formId: string
  isAdmin: boolean
  businessHours: BusinessHours | null
  escalationEmail: string
  escalationSms: string
  state: SettingsActionState
  formAction: (formData: FormData) => void
}

const inputClass =
  'w-full rounded-[var(--radius-sm)] border px-3 py-2 text-base outline-none transition [background:var(--glass-bg-strong)] [border-color:var(--glass-border-strong)] [color:var(--color-on-glass)] placeholder:[color:var(--color-on-glass-subtle)] focus:[border-color:var(--color-lavender-300)] focus:shadow-[var(--shadow-focus)]'

// The dropdown popup inherits the control's text color, so pin readable
// option colors explicitly — a white-on-white list would otherwise be
// invisible in browsers that paint the popup with the select's own color.
const selectClass = `${inputClass} [&>option]:[background:var(--color-ink)] [&>option]:[color:var(--color-on-glass)]`

// Value = the 0=Sun..6=Sat convention BusinessHours.days already uses
// (lib/utils/time.ts), displayed in natural Mon-first week order.
const DAYS: { value: number; label: string }[] = [
  { value: 1, label: 'Mon' },
  { value: 2, label: 'Tue' },
  { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' },
  { value: 5, label: 'Fri' },
  { value: 6, label: 'Sat' },
  { value: 0, label: 'Sun' },
]

// A curated list rather than the full IANA tz database — this is a
// property-management SaaS operating in the US, and a long unfiltered list
// (400+ zones) is worse UX than a short relevant one.
const TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Phoenix',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
]

function FieldRow({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-4">
      <label htmlFor={htmlFor} className="text-sm font-medium [color:var(--color-on-glass-muted)] sm:w-32 sm:shrink-0 sm:pt-2">
        {label}
      </label>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

function ReadOnlyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-4">
      <p className="text-sm font-medium [color:var(--color-on-glass-muted)] sm:w-32 sm:shrink-0">{label}</p>
      <p className="text-sm [color:var(--color-on-glass)]">{value || '—'}</p>
    </div>
  )
}

export default function BusinessSettingsPanel({
  formId,
  isAdmin,
  businessHours,
  escalationEmail,
  escalationSms,
  state,
  formAction,
}: BusinessSettingsPanelProps) {
  if (!isAdmin) {
    const dayLabel = businessHours?.days?.length
      ? DAYS.filter((d) => businessHours.days.includes(d.value)).map((d) => d.label).join(', ')
      : ''

    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm [color:var(--color-on-glass-muted)]">
          Only admins can edit business hours and the escalation contact.
        </p>
        <ReadOnlyValue label="Timezone" value={businessHours?.timezone ?? ''} />
        <ReadOnlyValue label="Business days" value={dayLabel} />
        <ReadOnlyValue
          label="Hours"
          value={businessHours?.start && businessHours?.end ? `${businessHours.start}–${businessHours.end}` : ''}
        />
        <ReadOnlyValue label="Escalation email" value={escalationEmail} />
        <ReadOnlyValue label="Escalation SMS" value={escalationSms} />
      </div>
    )
  }

  return (
    <form id={formId} action={formAction} className="flex flex-col gap-5">
      {state && <FeedbackBanner state={state} />}

      <FieldRow label="Timezone" htmlFor="business-timezone">
        <select
          id="business-timezone"
          name="timezone"
          required
          defaultValue={businessHours?.timezone ?? ''}
          className={selectClass}
        >
          <option value="" disabled>
            Select a timezone
          </option>
          {TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>
              {tz.replace('_', ' ')}
            </option>
          ))}
        </select>
      </FieldRow>

      <FieldRow label="Business days" htmlFor="business-days-0">
        <div className="flex flex-wrap gap-3">
          {DAYS.map((day) => (
            <label
              key={day.value}
              className="flex cursor-pointer items-center gap-1.5 rounded-[var(--radius-sm)] border px-2.5 py-1.5 text-sm font-medium transition-colors [border-color:var(--glass-border)] [color:var(--color-on-glass)] has-[:checked]:[background:var(--color-lavender-300)] has-[:checked]:[border-color:var(--color-lavender-300)] has-[:checked]:[color:var(--color-ink)]"
            >
              <input
                type="checkbox"
                name="days"
                value={day.value}
                defaultChecked={businessHours?.days?.includes(day.value) ?? false}
                className="accent-[var(--color-ink)]"
              />
              {day.label}
            </label>
          ))}
        </div>
      </FieldRow>

      <FieldRow label="Opens" htmlFor="business-start">
        <input
          id="business-start"
          name="start"
          type="time"
          required
          defaultValue={businessHours?.start ?? '09:00'}
          className={inputClass}
        />
      </FieldRow>

      <FieldRow label="Closes" htmlFor="business-end">
        <input
          id="business-end"
          name="end"
          type="time"
          required
          defaultValue={businessHours?.end ?? '17:00'}
          className={inputClass}
        />
        <p className="mt-1.5 text-xs [color:var(--color-on-glass-subtle)]">
          Drives the after-hours auto-reply and the end-of-day unread digest.
        </p>
      </FieldRow>

      <div className="h-px [background:var(--glass-border)]" />

      <FieldRow label="Escalation email" htmlFor="escalation-email">
        <input
          id="escalation-email"
          name="escalationEmail"
          type="email"
          defaultValue={escalationEmail}
          placeholder="Optional"
          className={inputClass}
        />
      </FieldRow>

      <FieldRow label="Escalation SMS" htmlFor="escalation-sms">
        <input
          id="escalation-sms"
          name="escalationSms"
          type="tel"
          defaultValue={escalationSms}
          placeholder="Optional"
          className={inputClass}
        />
        <p className="mt-1.5 text-xs [color:var(--color-on-glass-subtle)]">
          Texted immediately when a tenant reports an emergency.
        </p>
      </FieldRow>
    </form>
  )
}
