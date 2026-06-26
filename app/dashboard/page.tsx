import Link from 'next/link'
import { supabase } from '@/lib/integrations/supabase'
import { timeAgo } from '@/lib/utils/time'
import type { Conversation } from '@/types'

// Phase 1 single-tenant: client is hardcoded.
type StatCard = {
  label: string
  value: number
  href: string
  accent: string // tailwind text color class for the number/icon
  iconBg: string // tailwind bg color class for the icon chip
  icon: React.ReactNode
}

function getLastMessage(messages: Conversation['messages']): Conversation['messages'][number] | null {
  if (!messages || messages.length === 0) return null
  return [...messages].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0]
}

export default async function OverviewPage() {
  const [
    openTicketsRes,
    unreadMessagesRes,
    escalatedRes,
    recentConversationsRes,
  ] = await Promise.all([
    // Unapproved maintenance tickets: status = 'open'
    supabase
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'open'),
    // Unread messages: inbound messages not yet marked read
    supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('direction', 'inbound')
      .eq('is_read', false),
    // Conversations needing manual response: status = 'escalated'
    supabase
      .from('conversations')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'escalated'),
    // 5 most recent conversations with tenant + messages for preview
    supabase
      .from('conversations')
      .select('id, status, created_at, last_message_at, tenants(id, phone, name), messages(body, direction, created_at, is_read)')
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(5),
  ])

  const loadError =
    openTicketsRes.error ||
    unreadMessagesRes.error ||
    escalatedRes.error ||
    recentConversationsRes.error

  if (loadError) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-md rounded-xl border border-[#fecaca] bg-[#fef2f2] p-6 text-center">
          <p className="text-sm font-semibold text-[#b91c1c]">Unable to load the overview</p>
          <p className="mt-1 text-sm text-[#7f1d1d]">{loadError.message}</p>
        </div>
      </div>
    )
  }

  const stats: StatCard[] = [
    {
      label: 'Unapproved maintenance tickets',
      value: openTicketsRes.count ?? 0,
      href: '/dashboard/maintenance',
      accent: 'text-[#1565c0]',
      iconBg: 'bg-[#e8f0fe]',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14.7 6.3a4 4 0 0 0-5.3 5.3l-6 6a1.5 1.5 0 0 0 2.1 2.1l6-6a4 4 0 0 0 5.3-5.3l-2.4 2.4-2.1-2.1 2.4-2.4z" />
        </svg>
      ),
    },
    {
      label: 'Unread messages',
      value: unreadMessagesRes.count ?? 0,
      href: '/dashboard/conversations',
      accent: 'text-[#0f9d58]',
      iconBg: 'bg-[#e6f4ea]',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
      ),
    },
    {
      label: 'Conversations needing manual response',
      value: escalatedRes.count ?? 0,
      href: '/dashboard/conversations',
      accent: 'text-[#d93025]',
      iconBg: 'bg-[#fce8e6]',
      icon: (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
        </svg>
      ),
    },
  ]

  const recent = (recentConversationsRes.data ?? []) as unknown as Conversation[]

  return (
    <div className="flex-1 overflow-y-auto px-8 py-7">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-[#344767]">Overview</h1>
        <p className="mt-1 text-sm text-[#7b809a]">A snapshot of what needs your attention.</p>
      </header>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="group rounded-2xl bg-white p-5 shadow-[0_4px_24px_rgba(52,71,103,0.10)] transition hover:shadow-[0_8px_28px_rgba(52,71,103,0.16)]"
          >
            <div className="flex items-start justify-between">
              <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${stat.iconBg} ${stat.accent}`}>
                {stat.icon}
              </span>
              <span className={`text-3xl font-bold ${stat.accent}`}>{stat.value}</span>
            </div>
            <p className="mt-4 text-sm font-medium text-[#7b809a]">{stat.label}</p>
          </Link>
        ))}
      </div>

      <section className="mt-9">
        <h2 className="mb-3 text-lg font-semibold text-[#344767]">Recent Activity</h2>
        <div className="overflow-hidden rounded-2xl bg-white shadow-[0_4px_24px_rgba(52,71,103,0.10)]">
          {recent.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-[#b0b7c3]">No conversations yet.</p>
          ) : (
            <ul className="divide-y divide-[rgba(52,71,103,0.06)]">
              {recent.map((conv) => {
                const tenant = conv.tenants
                const displayName = tenant?.name
                  ? `${tenant.name} · ${tenant.phone}`
                  : tenant?.phone ?? 'Unknown'
                const last = getLastMessage(conv.messages)
                const preview = last
                  ? (last.direction === 'outbound' ? 'You: ' : '') + last.body
                  : 'No messages yet'
                const timeLabel = last ? timeAgo(last.created_at) : timeAgo(conv.created_at)

                return (
                  <li key={conv.id}>
                    <Link
                      href={`/dashboard/conversations/${conv.id}`}
                      className="flex items-center gap-4 px-5 py-3.5 transition hover:bg-[#f5f8ff]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-[#344767]">{displayName}</p>
                          {conv.status === 'escalated' && (
                            <span className="shrink-0 rounded-full bg-[#fce8e6] px-2 py-0.5 text-[11px] font-semibold text-[#d93025]">
                              Escalated
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-sm text-[#7b809a]">{preview}</p>
                      </div>
                      <span className="shrink-0 text-xs text-[#b0b7c3]">{timeLabel}</span>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}
