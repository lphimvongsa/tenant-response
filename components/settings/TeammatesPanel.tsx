'use client'

import { useActionState, useState } from 'react'
import { useFormStatus } from 'react-dom'
import type { Teammate } from '@/lib/integrations/team'
import type { SettingsActionState } from '@/app/dashboard/settings/actions'
import { regenerateJoinCodeAction, removeTeammateAction } from '@/app/dashboard/settings/actions'
import { computeInitials } from '@/lib/utils/initials'
import FeedbackBanner from './FeedbackBanner'

interface TeammatesPanelProps {
  role: string
  managerId: string
  teammates: Teammate[]
  joinCode: string | null
}

const secondaryBtn =
  'rounded-[var(--radius-sm)] border px-3 py-2 text-sm font-semibold transition-colors [background:var(--color-bg-surface)] [border-color:var(--color-input-border)] [color:var(--color-text-primary)] hover:[background:var(--color-bg-hover)] disabled:cursor-not-allowed disabled:opacity-50'

function RoleBadge({ role }: { role: string }) {
  const isAdmin = role === 'admin'
  return (
    <span
      className={`shrink-0 rounded-[var(--radius-pill)] px-2 py-0.5 text-[11px] font-semibold capitalize ${
        isAdmin
          ? '[background:var(--color-bg-elevated)] [color:var(--color-brand-dark)]'
          : '[background:var(--color-input-bg)] [color:var(--color-text-secondary)]'
      }`}
    >
      {role || 'member'}
    </span>
  )
}

// Per-row submit button; useFormStatus scopes the pending flag to this
// specific <form>, so only the row being removed shows a spinner label.
function RemoveButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-[var(--radius-sm)] px-2.5 py-1.5 text-xs font-semibold transition-colors [color:var(--color-error)] hover:[background:var(--color-error-bg-hover)] disabled:opacity-50"
    >
      {pending ? 'Removing…' : 'Remove'}
    </button>
  )
}

export default function TeammatesPanel({
  role,
  managerId,
  teammates,
  joinCode,
}: TeammatesPanelProps) {
  const isAdmin = role === 'admin'
  const [copied, setCopied] = useState(false)

  const [regenState, regenAction, regenPending] = useActionState<SettingsActionState, FormData>(
    regenerateJoinCodeAction,
    undefined,
  )
  // One shared action instance for every row's Remove form; the latest
  // submission's result flows into removeState.
  const [removeState, removeAction] = useActionState<SettingsActionState, FormData>(
    removeTeammateAction,
    undefined,
  )

  async function handleCopy() {
    if (!joinCode) {
      return
    }
    try {
      await navigator.clipboard.writeText(joinCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard access can be blocked by the browser; the code is visible
      // for manual selection, so silently ignore.
    }
  }

  return (
    <div>
      {isAdmin && (
        <div className="border-b pb-6 [border-color:var(--color-border)]">
          <p className="text-sm font-semibold [color:var(--color-text-primary)]">Team join code</p>
          <p className="mt-0.5 text-sm [color:var(--color-text-secondary)]">
            Share this code with teammates so they can create an account.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="rounded-[var(--radius-sm)] border px-3 py-2 font-mono text-sm font-semibold tracking-widest [background:var(--color-input-bg)] [border-color:var(--color-input-border)] [color:var(--color-text-primary)]">
              {joinCode ?? 'Unavailable'}
            </code>
            <button type="button" onClick={handleCopy} disabled={!joinCode} className={secondaryBtn}>
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <form
              action={regenAction}
              onSubmit={(e) => {
                if (
                  !window.confirm(
                    'Regenerate the join code? The current code will stop working for new invites. Teammates who already signed up keep their access.',
                  )
                ) {
                  e.preventDefault()
                }
              }}
            >
              <button type="submit" disabled={regenPending} className={secondaryBtn}>
                {regenPending ? 'Regenerating…' : 'Regenerate'}
              </button>
            </form>
          </div>

          {regenState && (
            <div className="mt-3">
              <FeedbackBanner state={regenState} />
            </div>
          )}
        </div>
      )}

      <div className={isAdmin ? 'mt-6' : ''}>
        <p className="text-sm font-semibold [color:var(--color-text-primary)]">Teammates</p>

        {removeState && (
          <div className="mt-3">
            <FeedbackBanner state={removeState} />
          </div>
        )}

        {teammates.length === 0 ? (
          <p className="mt-3 text-sm [color:var(--color-text-secondary)]">No teammates yet.</p>
        ) : (
          <ul className="mt-2">
            {teammates.map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-3 border-b py-3 last:border-b-0 [border-color:var(--color-border-subtle)]"
              >
                <div
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white [background:var(--color-brand-gradient)]"
                >
                  {computeInitials(t.name, t.email)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold [color:var(--color-text-primary)]">
                      {t.name || t.email || 'Unknown'}
                    </p>
                    <RoleBadge role={t.role} />
                    {t.id === managerId && (
                      <span className="text-xs [color:var(--color-text-muted)]">You</span>
                    )}
                  </div>
                  <p className="truncate text-xs [color:var(--color-text-secondary)]">
                    {t.email || '—'}
                  </p>
                </div>

                <div className="hidden shrink-0 text-xs [color:var(--color-text-secondary)] sm:block">
                  {t.phone || '—'}
                </div>

                {isAdmin && t.id !== managerId && (
                  <form action={removeAction} className="shrink-0">
                    <input type="hidden" name="targetManagerId" value={t.id} />
                    <RemoveButton />
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
