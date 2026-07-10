import Link from 'next/link'
import { redirect } from 'next/navigation'
import { supabase } from '@/lib/integrations/supabase'
import { getCurrentManager } from '@/lib/integrations/supabase-auth'
import { timeAgo } from '@/lib/utils/time'
import type { Conversation } from '@/types'
import { type TrendPoint } from '@/components/dashboard/TrendChart'
import { type ResponseTotals } from '@/components/dashboard/ResponseChart'
import DashboardTrends, { type Period, type PeriodData } from '@/components/dashboard/DashboardTrends'
import ConversationSummaryList, { type ConversationSummaryItem } from '@/components/dashboard/ConversationSummaryList'

const WEEK_DAYS = 7
// Fetch a full year of messages up front so the week/month/year toggle can
// switch datasets client-side with no refetch — a year comfortably covers
// all three bucketings computed below.
const TREND_FETCH_DAYS = 366

// ── Module-level date helpers ────────────────────────────────────────────────
// The react-hooks/purity lint rule errors on `Date.now()` / `new Date()` called
// directly in a render body, but permits calls made through a named helper.
function daysAgoISO(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function buildDayBuckets(days: number): { key: string; label: string }[] {
  const now = Date.now()
  const buckets: { key: string; label: string }[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now - i * 86_400_000)
    buckets.push({
      key: d.toISOString().slice(0, 10),
      label: d.toLocaleDateString('en-US', { weekday: 'short' }),
    })
  }
  return buckets
}

// Every day (1..N) of the current calendar month.
function buildMonthDayBuckets(): { key: string; label: string }[] {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const buckets: { key: string; label: string }[] = []
  for (let d = 1; d <= daysInMonth; d++) {
    buckets.push({ key: `${year}-${pad2(month + 1)}-${pad2(d)}`, label: String(d) })
  }
  return buckets
}

// Every month (Jan..Dec) of the current calendar year.
function buildYearMonthBuckets(): { key: string; label: string }[] {
  const now = new Date()
  const year = now.getFullYear()
  const buckets: { key: string; label: string }[] = []
  for (let m = 0; m < 12; m++) {
    buckets.push({
      key: `${year}-${pad2(m + 1)}`,
      label: new Date(year, m, 1).toLocaleDateString('en-US', { month: 'short' }),
    })
  }
  return buckets
}

// Buckets messages by the given key length sliced off `created_at`
// (10 = "YYYY-MM-DD" for day buckets, 7 = "YYYY-MM" for month buckets).
function bucketMessages(
  messages: TrendMessage[],
  buckets: { key: string; label: string }[],
  keyLength: number
): TrendPoint[] {
  const inboundByKey = new Map<string, number>(buckets.map((b) => [b.key, 0]))
  const outboundByKey = new Map<string, number>(buckets.map((b) => [b.key, 0]))
  for (const m of messages) {
    const key = m.created_at.slice(0, keyLength)
    if (!inboundByKey.has(key)) continue
    if (m.direction === 'outbound') {
      outboundByKey.set(key, (outboundByKey.get(key) ?? 0) + 1)
    } else {
      inboundByKey.set(key, (inboundByKey.get(key) ?? 0) + 1)
    }
  }
  return buckets.map((b) => ({
    label: b.label,
    inbound: inboundByKey.get(b.key) ?? 0,
    outbound: outboundByKey.get(b.key) ?? 0,
  }))
}

// Totals (not bucketed over time) of outbound messages within the given
// period, split by who sent them: AI vs. a staff member replying manually.
function sumResponseTotals(
  messages: TrendMessage[],
  periodKeys: { key: string }[],
  keyLength: number
): ResponseTotals {
  const validKeys = new Set(periodKeys.map((b) => b.key))
  let ai = 0
  let manual = 0
  for (const m of messages) {
    if (m.direction !== 'outbound') continue
    if (!validKeys.has(m.created_at.slice(0, keyLength))) continue
    if (m.ai_generated) ai += 1
    else manual += 1
  }
  return { ai, manual }
}

// ── Types ────────────────────────────────────────────────────────────────────
// 'primary' = the dark ink hero tile; 'neutral' = a surface tile with a sunken
// icon chip; 'alert' = same neutral shell but the icon keeps the danger hue so
// escalation severity still reads at a glance.
type TileVariant = 'primary' | 'neutral' | 'alert'

type StatTile = {
  label: string
  value: number
  delta: number
  href: string
  variant: TileVariant
  icon: React.ReactNode
}

type TrendMessage = { direction: string; created_at: string; ai_generated: boolean }

function getLastMessage(messages: Conversation['messages']): Conversation['messages'][number] | null {
  if (!messages || messages.length === 0) return null
  return [...messages].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0]
}

const TILE_STYLES: Record<TileVariant, { card: string; label: string; value: string; delta: string; iconWrap: string }> = {
  primary: {
    card: 'text-white shadow-[var(--shadow-card)] [background:var(--color-ink)]',
    label: 'text-white/80',
    value: 'text-white',
    delta: 'text-white/70',
    iconWrap: 'bg-white/15 text-white',
  },
  neutral: {
    card: 'shadow-[var(--shadow-card)] [background:var(--color-bg-surface)]',
    label: '[color:var(--color-text-secondary)]',
    value: '[color:var(--color-text-primary)]',
    delta: '[color:var(--color-text-muted)]',
    iconWrap: '[background:var(--color-bg-sunken)] [color:var(--color-text-secondary)]',
  },
  alert: {
    card: 'shadow-[var(--shadow-card)] [background:var(--color-bg-surface)]',
    label: '[color:var(--color-text-secondary)]',
    value: '[color:var(--color-text-primary)]',
    delta: '[color:var(--color-text-muted)]',
    iconWrap: '[background:var(--color-bg-sunken)] [color:var(--color-danger)]',
  },
}

function getGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

export default async function OverviewPage() {
  const manager = await getCurrentManager()
  if (!manager) {
    // proxy.ts already gates /dashboard/**; this is a defensive fallback.
    redirect('/')
  }

  const clientId = manager.clientId
  const oneDayAgo = daysAgoISO(1)

  const [
    openTicketsRes,
    unreadMessagesRes,
    escalatedRes,
    ticketsTodayRes,
    escalatedTodayRes,
    recentConversationsRes,
    trendMessagesRes,
  ] = await Promise.all([
    supabase
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .in('status', ['open', 'in_progress', 'in_review']),
    supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .eq('direction', 'inbound')
      .eq('is_read', false),
    supabase
      .from('conversations')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .eq('status', 'escalated'),
    supabase
      .from('tickets')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .gte('created_at', oneDayAgo),
    supabase
      .from('conversations')
      .select('id', { count: 'exact', head: true })
      .eq('client_id', clientId)
      .eq('status', 'escalated')
      .gte('last_message_at', oneDayAgo),
    supabase
      .from('conversations')
      .select('id, status, created_at, last_message_at, tenants(id, phone, name), messages(body, direction, created_at, is_read)')
      .eq('client_id', clientId)
      .order('last_message_at', { ascending: false, nullsFirst: false })
      .limit(5),
    supabase
      .from('messages')
      .select('direction, created_at, ai_generated')
      .eq('client_id', clientId)
      .gte('created_at', daysAgoISO(TREND_FETCH_DAYS)),
  ])

  const loadError =
    openTicketsRes.error ||
    unreadMessagesRes.error ||
    escalatedRes.error ||
    ticketsTodayRes.error ||
    escalatedTodayRes.error ||
    recentConversationsRes.error ||
    trendMessagesRes.error

  if (loadError) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-md rounded-[var(--radius-lg)] border [border-color:var(--color-danger)] [background:var(--color-danger-bg)] p-6 text-center">
          <p className="text-sm font-semibold [color:var(--color-danger)]">Unable to load overview</p>
          <p className="mt-1 text-sm [color:var(--color-danger)]">{loadError.message}</p>
        </div>
      </div>
    )
  }

  // ── Trend chart: bucket message volume by day/month, split inbound / outbound ──
  const trendMessages = (trendMessagesRes.data ?? []) as TrendMessage[]

  const weekBuckets = buildDayBuckets(WEEK_DAYS)
  const monthBuckets = buildMonthDayBuckets()
  const yearBuckets = buildYearMonthBuckets()

  const weekData = bucketMessages(trendMessages, weekBuckets, 10)
  const monthData = bucketMessages(trendMessages, monthBuckets, 10)
  const yearData = bucketMessages(trendMessages, yearBuckets, 7)

  const trendsByPeriod: Record<Period, PeriodData> = {
    week: { volume: weekData, responses: sumResponseTotals(trendMessages, weekBuckets, 10) },
    month: { volume: monthData, responses: sumResponseTotals(trendMessages, monthBuckets, 10) },
    year: { volume: yearData, responses: sumResponseTotals(trendMessages, yearBuckets, 7) },
  }

  let inboundToday = 0
  for (const m of trendMessages) {
    if (m.direction !== 'outbound' && m.created_at >= oneDayAgo) inboundToday += 1
  }

  // ── Stat tiles ───────────────────────────────────────────────────────────────
  const tiles: StatTile[] = [
    {
      label: 'Open maintenance tickets',
      value: openTicketsRes.count ?? 0,
      delta: ticketsTodayRes.count ?? 0,
      href: '/dashboard/maintenance',
      variant: 'primary',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M14.7 6.3a4 4 0 0 0-5.3 5.3l-6 6a1.5 1.5 0 0 0 2.1 2.1l6-6a4 4 0 0 0 5.3-5.3l-2.4 2.4-2.1-2.1 2.4-2.4z" />
        </svg>
      ),
    },
    {
      label: 'Unread tenant messages',
      value: unreadMessagesRes.count ?? 0,
      delta: inboundToday,
      href: '/dashboard/conversations',
      variant: 'neutral',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
        </svg>
      ),
    },
    {
      label: 'Escalated threads',
      value: escalatedRes.count ?? 0,
      delta: escalatedTodayRes.count ?? 0,
      href: '/dashboard/conversations',
      variant: 'alert',
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
          <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
        </svg>
      ),
    },
  ]

  const recent = (recentConversationsRes.data ?? []) as unknown as Conversation[]

  // ── Conversations side-panel: unread + escalated at a glance ─────────────────
  const conversationSummaries: ConversationSummaryItem[] = recent.map((conv) => {
    const tenant = conv.tenants
    const displayName = tenant?.name ?? tenant?.phone ?? 'Unknown'
    const last = getLastMessage(conv.messages)
    const timeLabel = last ? timeAgo(last.created_at) : timeAgo(conv.created_at)
    const unreadCount = (conv.messages ?? []).filter(
      (m) => m.direction === 'inbound' && !m.is_read
    ).length

    return {
      id: conv.id,
      name: displayName,
      timeLabel,
      unreadCount,
      escalated: conv.status === 'escalated',
    }
  })

  const greeting = getGreeting()

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-5 pb-[calc(var(--bottom-nav-height)+1.5rem)] md:px-8 md:py-7 md:pb-7">

      {/* ── Header: heading + stat tiles ── */}
      <div className="flex flex-col gap-5">
        <div>
          <h1 className="text-2xl font-bold [color:var(--color-text-primary)]">{greeting}</h1>
          <p className="mt-1 text-sm [color:var(--color-text-secondary)]">
            Here&apos;s whats going on in your properties
          </p>
        </div>

        {/* Stat tiles */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          {tiles.map((tile) => {
            const s = TILE_STYLES[tile.variant]
            return (
              <Link
                key={tile.label}
                href={tile.href}
                className={`group flex h-32 flex-col justify-between rounded-[var(--radius-lg)] px-5 py-4 transition-transform hover:-translate-y-0.5 ${s.card}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-xs font-semibold leading-tight ${s.label}`}>{tile.label}</p>
                  <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${s.iconWrap}`}>
                    {tile.icon}
                  </span>
                </div>
                <div className="flex items-end justify-between gap-2">
                  <span className={`text-3xl font-bold tabular-nums ${s.value}`}>{tile.value}</span>
                  <span className={`text-xs font-medium ${s.delta}`}>
                    +{tile.delta} last day
                  </span>
                </div>
              </Link>
            )
          })}
        </div>
      </div>

      {/* ── Charts (left) + conversations side-list (right) ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px] lg:items-start">
        <DashboardTrends data={trendsByPeriod} />
        <ConversationSummaryList conversations={conversationSummaries} />
      </div>

      
    </div>
  )
}
