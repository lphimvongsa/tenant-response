'use client'

import type { ReactNode } from 'react'

const BackIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
  </svg>
)

type Props = {
  title: string
  onBack: () => void
  // Matches the desktop "Save Changes" button's `form=` attribute trick — a
  // form living elsewhere in the DOM (inside `children`) still submits via
  // this button regardless of where the button itself renders.
  saveFormId?: string
  savePending?: boolean
  children: ReactNode
}

// Full-screen drill-down for one settings section on mobile. Sits above the
// bottom tab bar (z-30) and below true modals (z-50) — see the mobile
// z-index stack comment in app/globals.css.
export default function MobileSettingsPanel({ title, onBack, saveFormId, savePending, children }: Props) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col [background:var(--color-bg-base)]">
      <div className="flex flex-shrink-0 items-center justify-between gap-3 border-b px-4 py-3 [border-color:var(--color-border)] [background:var(--color-bg-surface)]">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to settings"
          className="flex h-9 w-9 items-center justify-center rounded-lg [color:var(--color-text-secondary)] hover:[background:var(--color-bg-hover)]"
        >
          {BackIcon}
        </button>
        <h2 className="flex-1 truncate text-center text-sm font-bold [color:var(--color-text-primary)]">
          {title}
        </h2>
        {saveFormId ? (
          <button
            type="submit"
            form={saveFormId}
            disabled={savePending}
            className="shrink-0 rounded-[var(--radius-sm)] px-3 py-1.5 text-xs font-semibold text-white shadow-[var(--shadow-button)] transition-shadow [background:var(--color-brand-gradient)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {savePending ? 'Saving…' : 'Save'}
          </button>
        ) : (
          <span className="h-9 w-9" aria-hidden="true" />
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-5 pb-[calc(var(--bottom-nav-height)+1.5rem)]">
        {children}
      </div>
    </div>
  )
}
