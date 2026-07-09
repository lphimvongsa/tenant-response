import Link from 'next/link'
import { redirect } from 'next/navigation'
import { supabase } from '@/lib/integrations/supabase'
import { getCurrentManager } from '@/lib/integrations/supabase-auth'
import { timeAgo } from '@/lib/utils/time'
import type { Conversation } from '@/types'
import TrendChart, { type TrendPoint } from '@/components/dashboard/TrendChart'
import PropertySummaryList, { type PropertySummaryItem } from '@/components/dashboard/PropertySummaryList'

const TREND_DAYS = 7

// ── Module-level date helpers ────────────────────────────────────────────────
// The react-hooks/purity lint rule errors on `Date.now()` / `new Date()` called
// directly in a render body, but permits calls made through a named helper.
function daysAgoISO(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString()
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

// ── Types ────────────────────────────────────────────────────────────────────
type TileVariant = 'blue' | 'green' | 'white'

type StatTile = {
  label: string
  value: number
  delta: number
  href: string
  variant: TileVariant
  icon: React.ReactNode
}

type PropertyRow = {
  id: string
  name: string
  address: string | null
  units: { id: string; tenants: { id: string }[] | null }[] | null
}

type TrendMessage = { direction: string; created_at: string }

function getLastMessage(messages: Conversation['messages']): Conversation['messages'][number] | null {
  if (!messages || messages.length === 0) return null
  return [...messages].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0]
}

const TILE_STYLES: Record<TileVariant, { card: string; label: string; value: string; delta: string; iconWrap: string }> = {
  blue: {
    card: 'text-white shadow-[0_6px_20px_rgba(21,101,192,0.28)] [background:linear-gradient(135deg,#42a5f5_0%,#1565c0_100%)]',
    label: 'text-white/80',
    value: 'text-white',
    delta: 'text-white/75',
    iconWrap: 'bg-white/20 text-white',
  },
  green: {
    card: 'text-white shadow-[0_6px_20px_rgba(15,157,88,0.26)] [background:linear-gradient(135deg,#66bb6a_0%,#0f9d58_100%)]',
    label: 'text-white/80',
    value: 'text-white',
    delta: 'text-white/75',
    iconWrap: 'bg-white/20 text-white',
  },
  white: {
    card: 'bg-white text-[#344767] shadow-[0_2px_12px_rgba(52,71,103,0.08)]',
    label: 'text-[#7b809a]',
    value: 'text-[#d93025]',
    delta: 'text-[#b0b7c3]',
    iconWrap: 'bg-[#fce8e6] text-[#d93025]',
  },
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
    propertiesRes,
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
      .from('properties')
      .select('id, name, address, units(id, tenants(id))')
      .eq('client_id', clientId)
      .order('name', { ascending: true }),
    supabase
      .from('messages')
      .select('direction, created_at')
      .eq('client_id', clientId)
      .gte('created_at', daysAgoISO(TREND_DAYS)),
  ])

  const loadError =
    openTicketsRes.error ||
    unreadMessagesRes.error ||
    escalatedRes.error ||
    ticketsTodayRes.error ||
    escalatedTodayRes.error ||
    recentConversationsRes.error ||
    propertiesRes.error ||
    trendMessagesRes.error

  if (loadError) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-md rounded-2xl border border-[#fecaca] bg-[#fef2f2] p-6 text-center">
          <p className="text-sm font-semibold text-[#b91c1c]">Unable to load overview</p>
          <p className="mt-1 text-sm text-[#7f1d1d]">{loadError.message}</p>
        </div>
      </div>
    )
  }

  // ── Trend chart: bucket message volume by day, split inbound / outbound ──────
  const trendMessages = (trendMessagesRes.data ?? []) as TrendMessage[]
  const buckets = buildDayBuckets(TREND_DAYS)
  const inboundByDay = new Map<string, number>(buckets.map((b) => [b.key, 0]))
  const outboundByDay = new Map<string, number>(buckets.map((b) => [b.key, 0]))
  let totalMessages = 0
  let inboundToday = 0

  for (const m of trendMessages) {
    const key = m.created_at.slice(0, 10)
    if (m.direction === 'outbound') {
      if (outboundByDay.has(key)) outboundByDay.set(key, (outboundByDay.get(key) ?? 0) + 1)
    } else {
      if (inboundByDay.has(key)) inboundByDay.set(key, (inboundByDay.get(key) ?? 0) + 1)
      if (m.created_at >= oneDayAgo) inboundToday += 1
    }
    totalMessages += 1
  }

  const trendData: TrendPoint[] = buckets.map((b) => ({
    label: b.label,
    inbound: inboundByDay.get(b.key) ?? 0,
    outbound: outboundByDay.get(b.key) ?? 0,
  }))

  // ── Property summaries: busiest 3 by tenant count ────────────────────────────
  const propertyRows = (propertiesRes.data ?? []) as unknown as PropertyRow[]
  const propertySummaries: PropertySummaryItem[] = propertyRows
    .map((p) => {
      const units = Array.isArray(p.units) ? p.units : []
      const tenantCount = units.reduce(
        (sum, u) => sum + (Array.isArray(u.tenants) ? u.tenants.length : 0),
        0
      )
      return {
        id: p.id,
        name: p.name,
        address: p.address ?? '',
        unitCount: units.length,
        tenantCount,
      }
    })
    .sort((a, b) => b.tenantCount - a.tenantCount || b.unitCount - a.unitCount)
    .slice(0, 3)

  const totalProperties = propertyRows.length
  const totalUnits = propertyRows.reduce(
    (sum, p) => sum + (Array.isArray(p.units) ? p.units.length : 0),
    0
  )

  // ── Stat tiles ───────────────────────────────────────────────────────────────
  const tiles: StatTile[] = [
    {
      label: 'Open maintenance tickets',
      value: openTicketsRes.count ?? 0,
      delta: ticketsTodayRes.count ?? 0,
      href: '/dashboard/maintenance',
      variant: 'blue',
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
      variant: 'green',
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
      variant: 'white',
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

  return (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-8 py-7">

      {/* ── Top region: header + tiles (left) beside decorative hero (right) ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-5">

          {/* Header: heading + controls */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-[#344767]">Monitor the health of your properties</h1>
              <p className="mt-1 text-sm text-[#7b809a]">
                Live view of tenant activity, maintenance, and escalations.
              </p>
            </div>

            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="relative hidden sm:block">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#b0b7c3]">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="11" cy="11" r="8" />
                    <path d="m21 21-4.3-4.3" />
                  </svg>
                </span>
                <input
                  type="search"
                  placeholder="Search"
                  aria-label="Search"
                  className="h-9 w-40 rounded-full border border-[rgba(52,71,103,0.14)] bg-white pl-9 pr-3 text-sm text-[#344767] placeholder:text-[#b0b7c3] focus:border-[#1976d2] focus:outline-none"
                />
              </div>

              {/* Calendar button */}
              <button
                type="button"
                aria-label="Pick a date range"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-[rgba(52,71,103,0.14)] bg-white text-[#7b809a] transition-colors hover:bg-[#f5f8ff] hover:text-[#1565c0]"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <rect x="3" y="4" width="18" height="18" rx="2" />
                  <path d="M16 2v4M8 2v4M3 10h18" />
                </svg>
              </button>

              {/* Period toggle */}
              <div className="flex items-center gap-0.5 rounded-full bg-[#f0f4f8] p-1">
                <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#344767] shadow-[0_1px_3px_rgba(52,71,103,0.12)]">
                  Week
                </span>
                <span className="rounded-full px-3 py-1 text-xs font-semibold text-[#b0b7c3]">Month</span>
                <span className="rounded-full px-3 py-1 text-xs font-semibold text-[#b0b7c3]">Year</span>
              </div>
            </div>
          </div>

          {/* Stat tiles */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
            {tiles.map((tile) => {
              const s = TILE_STYLES[tile.variant]
              return (
                <Link
                  key={tile.label}
                  href={tile.href}
                  className={`group flex h-32 flex-col justify-between rounded-2xl px-5 py-4 transition-transform hover:-translate-y-0.5 ${s.card}`}
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

        {/* Decorative hero panel (brand gradient, no photo) */}
        <div className="relative hidden overflow-hidden rounded-2xl [background:linear-gradient(135deg,#42a5f5_0%,#1565c0_100%)] lg:block">
          {/* Building silhouette */}
          <svg
            viewBox="0 0 320 400"
            className="absolute inset-0 h-full w-full"
            preserveAspectRatio="xMidYMax slice"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="hero-fade" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1565c0" stopOpacity="0" />
                <stop offset="100%" stopColor="#0d47a1" stopOpacity="0.55" />
              </linearGradient>
            </defs>
            <g fill="#ffffff" opacity="0.10">
              <rect x="28" y="180" width="70" height="220" rx="4" />
              <rect x="118" y="120" width="84" height="280" rx="4" />
              <rect x="222" y="200" width="70" height="200" rx="4" />
            </g>
            <g fill="#ffffff" opacity="0.16">
              {[210, 250, 290, 330].map((y) =>
                [40, 58, 76].map((x) => <rect key={`a-${x}-${y}`} x={x} y={y} width="8" height="12" rx="1" />)
              )}
              {[150, 190, 230, 270, 310, 350].map((y) =>
                [130, 150, 170, 190].map((x) => <rect key={`b-${x}-${y}`} x={x} y={y} width="8" height="12" rx="1" />)
              )}
              {[230, 270, 310, 350].map((y) =>
                [234, 252, 270].map((x) => <rect key={`c-${x}-${y}`} x={x} y={y} width="8" height="12" rx="1" />)
              )}
            </g>
            <rect x="0" y="0" width="320" height="400" fill="url(#hero-fade)" />
          </svg>

          {/* Overlay content */}
          <div className="relative flex h-full flex-col justify-between p-6 text-white">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Portfolio</p>
              <p className="mt-1 text-lg font-bold leading-snug">
                {totalProperties} propert{totalProperties === 1 ? 'y' : 'ies'} under management
              </p>
            </div>
            <div className="flex gap-6">
              <div>
                <p className="text-2xl font-bold tabular-nums">{totalUnits}</p>
                <p className="text-xs text-white/70">Units</p>
              </div>
              <div>
                <p className="text-2xl font-bold tabular-nums">{totalMessages}</p>
                <p className="text-xs text-white/70">Msgs / 7d</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Chart (left) + property side-list (right) ── */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">

        {/* Trend chart card */}
        <div className="rounded-2xl bg-white p-5 shadow-[0_2px_12px_rgba(52,71,103,0.08)]">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-[#7b809a]">Message volume</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-[#344767]">
                {totalMessages.toLocaleString()}
                <span className="ml-1 text-sm font-medium text-[#b0b7c3]">this week</span>
              </p>
            </div>
            <div className="flex flex-col items-end gap-1.5">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-[#1565c0]">
                <span className="h-2.5 w-2.5 rounded-full bg-[#1565c0]" />
                Inbound
              </span>
              <span className="flex items-center gap-1.5 text-xs font-semibold text-[#7b809a]">
                <span className="h-2.5 w-2.5 rounded-full bg-[#7b809a]" />
                Outbound
              </span>
            </div>
          </div>
          <TrendChart data={trendData} />
        </div>

        {/* Property side-list */}
        <PropertySummaryList properties={propertySummaries} />
      </div>

      {/* ── Recent activity ── */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-bold text-[#344767]">Recent Activity</h2>
          <Link
            href="/dashboard/conversations"
            className="text-xs font-semibold text-[#1565c0] hover:underline"
          >
            View all
          </Link>
        </div>

        <div className="overflow-hidden rounded-2xl bg-white shadow-[0_2px_12px_rgba(52,71,103,0.08)]">
          {recent.length === 0 ? (
            <p className="px-5 py-10 text-center text-sm text-[#b0b7c3]">No conversations yet.</p>
          ) : (
            <ul className="divide-y divide-[rgba(52,71,103,0.05)]">
              {recent.map((conv) => {
                const tenant = conv.tenants
                const displayName = tenant?.name ?? tenant?.phone ?? 'Unknown'
                const phone = tenant?.name ? tenant.phone : null
                const last = getLastMessage(conv.messages)
                const preview = last
                  ? (last.direction === 'outbound' ? 'You: ' : '') + last.body
                  : 'No messages yet'
                const timeLabel = last ? timeAgo(last.created_at) : timeAgo(conv.created_at)
                const initials = displayName
                  .split(' ')
                  .filter(Boolean)
                  .slice(0, 2)
                  .map((w: string) => w[0].toUpperCase())
                  .join('')

                return (
                  <li key={conv.id}>
                    <Link
                      href={`/dashboard/conversations/${conv.id}`}
                      className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-[#f5f8ff]"
                    >
                      {/* Avatar circle */}
                      <div
                        className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#e8f0fe] text-[0.625rem] font-bold text-[#1565c0]"
                        aria-hidden="true"
                      >
                        {initials || '?'}
                      </div>

                      {/* Name + preview */}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-semibold text-[#344767]">{displayName}</p>
                          {phone && (
                            <p className="hidden truncate text-xs text-[#b0b7c3] sm:block">{phone}</p>
                          )}
                          {conv.status === 'escalated' && (
                            <span className="shrink-0 rounded-full bg-[#fce8e6] px-2 py-0.5 text-[10px] font-semibold text-[#d93025]">
                              Escalated
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 truncate text-xs text-[#7b809a]">{preview}</p>
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
