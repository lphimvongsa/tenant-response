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

const AVATAR_COLORS = [
  'bg-[#e8f0fe] text-[#1565c0]',
  'bg-[#e6f4ea] text-[#0f9d58]',
  'bg-[#fef9c3] text-[#854d0e]',
  'bg-[#f3e8fd] text-[#7c3aed]',
  'bg-[#fce8e6] text-[#d93025]',
]

function initials(name: string): string {
  const parts = name.split(' ').filter(Boolean).slice(0, 2)
  const joined = parts.map((w) => w[0].toUpperCase()).join('')
  return joined || '?'
}

export default function ConversationSummaryList({ conversations }: { conversations: ConversationSummaryItem[] }) {
  return (
    <div className="flex h-full flex-col rounded-2xl bg-white p-5 shadow-[0_2px_12px_rgba(52,71,103,0.08)]">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-bold text-[#344767]">Conversations</h2>
        <Link
          href="/dashboard/conversations"
          className="text-xs font-semibold text-[#1565c0] hover:underline"
        >
          View all
        </Link>
      </div>

      {conversations.length === 0 ? (
        <p className="flex-1 px-2 py-10 text-center text-sm text-[#b0b7c3]">No conversations yet.</p>
      ) : (
        <ul className="flex flex-1 flex-col gap-1">
          {conversations.map((conv, i) => (
            <li key={conv.id}>
              <Link
                href={`/dashboard/conversations/${conv.id}`}
                className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-[#f5f8ff]"
              >
                <span
                  className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-xs font-bold ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}
                  aria-hidden="true"
                >
                  {initials(conv.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#344767]">{conv.name}</p>
                  <p className="truncate text-xs text-[#7b809a]">{conv.timeLabel}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {conv.escalated && (
                    <span className="rounded-full bg-[#fce8e6] px-2 py-1 text-[10px] font-semibold text-[#d93025]">
                      Escalated
                    </span>
                  )}
                  {conv.unreadCount > 0 && (
                    <span
                      className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-[#1565c0] px-1.5 text-[10px] font-bold text-white"
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
