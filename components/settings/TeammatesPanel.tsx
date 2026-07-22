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
  'rounded-[var(--radius-sm)] border px-3 py-2 text-sm font-semibold transition-colors [background:var(--glass-bg)] [border-color:var(--glass-border-strong)] [color:var(--color-on-glass)] hover:[background:var(--glass-bg-strong)] disabled:cursor-not-allowed disabled:opacity-50'

function RoleBadge({ role }: { role: string }) {
  const isAdmin = role === 'admin'
  return (
    <span
      className={`shrink-0 rounded-[var(--radius-pill)] px-2 py-0.5 text-[11px] font-semibold capitalize ${
        isAdmin
          ? '[background:var(--color-lavender-300)] [color:var(--color-ink)]'
          : 'glass-chip [color:var(--color-on-glass-muted)]'
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
      className="rounded-[var(--radius-sm)] px-2.5 py-1.5 text-xs font-semibold transition-colors [color:#ffb4b4] hover:bg-white/10 disabled:opacity-50"
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
        <div className="border-b pb-6 [border-color:var(--glass-border)]">
          <p className="text-sm font-semibold [color:var(--color-on-glass)]">Team join code</p>
          <p className="mt-0.5 text-sm [color:var(--color-on-glass-muted)]">
            Share this code with teammates so they can create an account.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <code className="glass-chip rounded-[var(--radius-sm)] px-3 py-2 font-mono text-sm font-semibold tracking-widest [color:var(--color-on-glass)]">
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
        <p className="text-sm font-semibold [color:var(--color-on-glass)]">Teammates</p>

        {removeState && (
          <div className="mt-3">
            <FeedbackBanner state={removeState} />
          </div>
        )}

        {teammates.length === 0 ? (
          <p className="mt-3 text-sm [color:var(--color-on-glass-muted)]">No teammates yet.</p>
        ) : (
          <ul className="mt-2">
            {teammates.map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-3 border-b py-3 last:border-b-0 [border-color:var(--glass-border)]"
              >
                <div
                  aria-hidden="true"
                  className="glass-chip flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold [color:var(--color-on-glass)]"
                >
                  {computeInitials(t.name, t.email)}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold [color:var(--color-on-glass)]">
                      {t.name || t.email || 'Unknown'}
                    </p>
                    <RoleBadge role={t.role} />
                    {t.id === managerId && (
                      <span className="text-xs [color:var(--color-on-glass-subtle)]">You</span>
                    )}
                  </div>
                  <p className="truncate text-xs [color:var(--color-on-glass-muted)]">
                    {t.email || '—'}
                  </p>
                </div>

                <div className="hidden shrink-0 text-xs [color:var(--color-on-glass-muted)] sm:block">
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
