// Side-list card ("Objects" in the reference layout) showing the busiest
// properties. Pure presentational — receives summaries as props. Uses
// initials-avatars (no real thumbnails) to match the Recent Activity visual
// language, and a count badge instead of a fabricated "% change" arrow.

import Link from 'next/link'

export type PropertySummaryItem = {
  id: string
  name: string
  address: string
  unitCount: number
  tenantCount: number
}

const AVATAR_COLORS = [
  'bg-[#e8f0fe] text-[#1565c0]',
  'bg-[#e6f4ea] text-[#0f9d58]',
  'bg-[#fef9c3] text-[#854d0e]',
]

function initials(name: string): string {
  const parts = name.split(' ').filter(Boolean).slice(0, 2)
  const joined = parts.map((w) => w[0].toUpperCase()).join('')
  return joined || '?'
}

export default function PropertySummaryList({ properties }: { properties: PropertySummaryItem[] }) {
  return (
    <div className="flex h-full flex-col rounded-2xl bg-white p-5 shadow-[0_2px_12px_rgba(52,71,103,0.08)]">
      {/* Tabs */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-1 rounded-full bg-[#f0f4f8] p-1">
          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#344767] shadow-[0_1px_3px_rgba(52,71,103,0.12)]">
            Objects
          </span>
          <span className="rounded-full px-3 py-1 text-xs font-semibold text-[#b0b7c3]">
            Realtors
          </span>
        </div>
        <Link
          href="/dashboard/properties"
          className="text-xs font-semibold text-[#1565c0] hover:underline"
        >
          View all
        </Link>
      </div>

      {/* List */}
      {properties.length === 0 ? (
        <p className="flex-1 px-2 py-10 text-center text-sm text-[#b0b7c3]">No properties yet.</p>
      ) : (
        <ul className="flex flex-1 flex-col gap-1">
          {properties.map((p, i) => (
            <li key={p.id}>
              <Link
                href={`/dashboard/properties/${p.id}`}
                className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition-colors hover:bg-[#f5f8ff]"
              >
                <span
                  className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl text-xs font-bold ${AVATAR_COLORS[i % AVATAR_COLORS.length]}`}
                  aria-hidden="true"
                >
                  {initials(p.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[#344767]">{p.name}</p>
                  <p className="truncate text-xs text-[#7b809a]">
                    {p.unitCount} unit{p.unitCount !== 1 ? 's' : ''}
                  </p>
                </div>
                <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#e6f4ea] px-2.5 py-1 text-xs font-semibold text-[#0f9d58]">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M18 15l-6-6-6 6" />
                  </svg>
                  {p.tenantCount}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
