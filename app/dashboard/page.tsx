import Link from 'next/link'
import { redirect } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { supabase } from '@/lib/integrations/supabase'
import { getCurrentManager } from '@/lib/integrations/supabase-auth'
import { timeAgo } from '@/lib/utils/time'
import { TICKETS_TAG, CONVERSATIONS_TAG } from '@/lib/cache-tags'
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

// Rounds "now" down to the minute so repeated calls within the same minute
// produce the exact same ISO string. That value is passed as a cache-key
// argument to getCachedOverviewData below — without rounding, every call
// would carry a unique millisecond timestamp and never hit the cache.
const CACHE_BUCKET_MS = 60_000

// ── Module-level date helpers ────────────────────────────────────────────────
// The react-hooks/purity lint rule errors on `Date.now()` / `new Date()` called
// directly in a render body, but permits calls made through a named helper.
function daysAgoISO(days: number): string {
  const bucketed = Math.floor(Date.now() / CACHE_BUCKET_MS) * CACHE_BUCKET_MS
  return new Date(bucketed - days * 86_400_000).toISOString()
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

const getCachedOverviewData = unstable_cache(
  async (clientId: string, oneDayAgo: string, trendSince: string) => {
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
        .gte('created_at', trendSince),
    ])

    const loadError =
      openTicketsRes.error ||
      unreadMessagesRes.error ||
      escalatedRes.error ||
      ticketsTodayRes.error ||
      escalatedTodayRes.error ||
      recentConversationsRes.error ||
      trendMessagesRes.error

    // Same shape whether or not there's an error, so callers never have to
    // deal with a discriminated union — just check `error` first.
    return {
      error: loadError?.message ?? null,
      openTickets: openTicketsRes.count ?? 0,
      unreadMessages: unreadMessagesRes.count ?? 0,
      escalated: escalatedRes.count ?? 0,
      ticketsToday: ticketsTodayRes.count ?? 0,
      escalatedToday: escalatedTodayRes.count ?? 0,
      recentConversations: (recentConversationsRes.data ?? []) as unknown as Conversation[],
      trendMessages: (trendMessagesRes.data ?? []) as TrendMessage[],
    }
  },
  ['dashboard-overview'],
  { revalidate: 30, tags: [TICKETS_TAG, CONVERSATIONS_TAG] },
)

function getLastMessage(messages: Conversation['messages']): Conversation['messages'][number] | null {
  if (!messages || messages.length === 0) return null
  return [...messages].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0]
}

// Glass redesign: every tile is the same frosted glass surface (via the shared
// .glass-panel / .glass-interactive utilities). Status is conveyed by the icon
// chip's hue, not the card fill — 'primary' gets a lavender-accent chip, 'alert'
// keeps the danger hue (brightened so it reads on the dark gradient), 'neutral'
// a plain translucent-white chip. All text is white/lavender-tinted since it now
// sits on glass over the dark gradient.
const TILE_STYLES: Record<TileVariant, { card: string; label: string; value: string; delta: string; iconWrap: string }> = {
  primary: {
    card: 'glass-panel glass-interactive',
    label: 'text-white/70',
    value: 'text-white',
    delta: 'text-white/55',
    iconWrap: '[background:rgba(183,166,255,0.22)] [color:#d8ccff]',
  },
  neutral: {
    card: 'glass-panel glass-interactive',
    label: 'text-white/70',
    value: 'text-white',
    delta: 'text-white/55',
    iconWrap: 'bg-white/10 text-white',
  },
  alert: {
    card: 'glass-panel glass-interactive',
    label: 'text-white/70',
    value: 'text-white',
    delta: 'text-white/55',
    iconWrap: '[background:rgba(214,69,69,0.24)] [color:#ffb4b4]',
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

  const overview = await getCachedOverviewData(clientId, oneDayAgo, daysAgoISO(TREND_FETCH_DAYS))

  if (overview.error) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 [background:var(--gradient-app-bg)]">
        <div className="max-w-md rounded-[var(--radius-lg)] border [border-color:rgba(255,180,180,0.4)] [background:rgba(214,69,69,0.14)] p-6 text-center shadow-[var(--glass-shadow)] backdrop-blur-xl">
          <p className="text-sm font-semibold [color:#ffb4b4]">Unable to load overview</p>
          <p className="mt-1 text-sm text-white/80">{overview.error}</p>
        </div>
      </div>
    )
  }

  // ── Trend chart: bucket message volume by day/month, split inbound / outbound ──
  const trendMessages = overview.trendMessages

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
      value: overview.openTickets,
      delta: overview.ticketsToday,
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
      value: overview.unreadMessages,
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
      value: overview.escalated,
      delta: overview.escalatedToday,
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

  const recent = overview.recentConversations

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
    // Paints the dark-purple gradient over .main's light base to reveal the
    // glass theme on this route only. Background sits on the scroll container
    // (default background-attachment) so it stays fixed while content scrolls.
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-4 py-5 pb-[calc(var(--bottom-nav-height)+1.5rem)] [background:var(--gradient-app-bg)] md:px-8 md:py-7 md:pb-7">

      {/* ── Header: heading + stat tiles ── */}
      <div className="flex flex-col gap-5">
        <div>
          <h1 className="text-lg font-bold [color:var(--color-on-glass)]">{greeting}</h1>
          <p className="mt-1 text-sm [color:var(--color-on-glass-muted)]">
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
                className={`group flex h-32 flex-col justify-between px-5 py-4 hover:-translate-y-0.5 ${s.card}`}
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
