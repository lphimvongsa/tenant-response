// Side-list card showing recent conversations and routing to their thread.
// Pure presentational — receives summaries as props. Surfaces unread count
// and escalated status so staff can spot what needs attention at a glance.

import Link from 'next/link'

export type ConversationSummaryItem = {
  id: string
  name: string
  timeLabel: string
  unreadCount: number
  escalated: boolean
}

// Monochrome avatar chip — the near-monochrome direction drops the old
// per-person hue rotation; initials carry the distinction, not colour.
// On the glass theme this is a translucent-white chip.
const AVATAR_STYLE = 'glass-chip [color:var(--color-on-glass)]'

function initials(name: string): string {
  const parts = name.split(' ').filter(Boolean).slice(0, 2)
  const joined = parts.map((w) => w[0].toUpperCase()).join('')
  return joined || '?'
}

export default function ConversationSummaryList({ conversations }: { conversations: ConversationSummaryItem[] }) {
  return (
    <div className="glass-panel flex h-full flex-col p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-bold [color:var(--color-on-glass)]">Conversations</h2>
        <Link
          href="/dashboard/conversations"
          className="text-xs font-semibold [color:var(--chart-line-secondary)] hover:underline"
        >
          View all
        </Link>
      </div>

      {conversations.length === 0 ? (
        <p className="flex-1 px-2 py-10 text-center text-sm [color:var(--color-on-glass-subtle)]">No conversations yet.</p>
      ) : (
        <ul className="flex flex-1 flex-col gap-1">
          {conversations.map((conv) => (
            <li key={conv.id}>
              <Link
                href={`/dashboard/conversations/${conv.id}`}
                className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-white/10"
              >
                <span
                  className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-xs font-bold ${AVATAR_STYLE}`}
                  aria-hidden="true"
                >
                  {initials(conv.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold [color:var(--color-on-glass)]">{conv.name}</p>
                  <p className="truncate text-xs [color:var(--color-on-glass-muted)]">{conv.timeLabel}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {conv.escalated && (
                    <span className="glass-chip inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold [color:#ffb4b4]">
                      <span className="h-1.5 w-1.5 rounded-full [background:var(--color-danger)]" />
                      Escalated
                    </span>
                  )}
                  {conv.unreadCount > 0 && (
                    <span
                      className="flex h-5 min-w-[20px] items-center justify-center rounded-full [background:var(--color-lavender-300)] px-1.5 text-[10px] font-bold [color:var(--color-ink)]"
                      aria-label={`${conv.unreadCount} unread`}
                    >
                      {conv.unreadCount}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
