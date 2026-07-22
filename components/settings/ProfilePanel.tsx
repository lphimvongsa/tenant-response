import type { ReactNode } from 'react'
import type { SettingsActionState } from '@/app/dashboard/settings/actions'
import FeedbackBanner from './FeedbackBanner'

interface ProfilePanelProps {
  formId: string
  name: string
  email: string
  phone: string
  initials: string
  state: SettingsActionState
  formAction: (formData: FormData) => void
}

const inputClass =
  'w-full rounded-[var(--radius-sm)] border px-3 py-2 text-base outline-none transition [background:var(--glass-bg-strong)] [border-color:var(--glass-border-strong)] [color:var(--color-on-glass)] placeholder:[color:var(--color-on-glass-subtle)] focus:[border-color:var(--color-lavender-300)] focus:shadow-[var(--shadow-focus)]'

function FieldRow({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5 sm:flex-row sm:items-start sm:gap-4">
      <label
        htmlFor={htmlFor}
        className="text-sm font-medium [color:var(--color-on-glass-muted)] sm:w-28 sm:shrink-0 sm:pt-2"
      >
        {label}
      </label>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

export default function ProfilePanel({
  formId,
  name,
  email,
  phone,
  initials,
  state,
  formAction,
}: ProfilePanelProps) {
  return (
    <div>
      <div className="flex items-center gap-4 border-b pb-5 [border-color:var(--glass-border)]">
        <div
          aria-hidden="true"
          className="glass-chip flex h-16 w-16 shrink-0 items-center justify-center rounded-full text-lg font-bold [color:var(--color-on-glass)]"
        >
          {initials}
        </div>
        <div className="min-w-0">
          <p className="truncate text-base font-bold [color:var(--color-on-glass)]">
            {name || 'Your account'}
          </p>
          <p className="truncate text-sm [color:var(--color-on-glass-muted)]">{email || '—'}</p>
        </div>
      </div>

      <form id={formId} action={formAction} className="mt-5 flex flex-col gap-5">
        {state && <FeedbackBanner state={state} />}

        <FieldRow label="Name" htmlFor="settings-name">
          <input
            id="settings-name"
            name="name"
            type="text"
            required
            autoComplete="name"
            defaultValue={name}
            placeholder="Your name"
            className={inputClass}
          />
        </FieldRow>

        <FieldRow label="Email" htmlFor="settings-email">
          <input
            id="settings-email"
            name="email"
            type="email"
            required
            autoComplete="email"
            defaultValue={email}
            placeholder="you@company.com"
            className={inputClass}
          />
          <p className="mt-1.5 text-xs [color:var(--color-on-glass-subtle)]">
            Changing your email sends a confirmation link to the new address before it takes effect.
          </p>
        </FieldRow>

        <FieldRow label="Phone" htmlFor="settings-phone">
          <input
            id="settings-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            defaultValue={phone}
            placeholder="Optional"
            className={inputClass}
          />
        </FieldRow>
      </form>
    </div>
  )
}
