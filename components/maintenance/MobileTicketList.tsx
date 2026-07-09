'use client'

import { useState } from 'react'
import {
  MAINTENANCE_CATEGORIES,
  maintenanceCategoryLabel,
} from '@/lib/maintenance-categories'
import {
  COLUMNS,
  SEVERITY_OPTIONS,
  TicketCard,
  type Ticket,
  type TicketStatus,
  type ScopedProperty,
} from './TicketList'

type PropertyOption = { id: string; name: string }
type UnitOption = { id: string; unitNumber: string; propertyName: string | null }

type Props = {
  tickets: Ticket[]
  activeStatus: string
  onChangeStatus: (status: string) => void
  search: string
  onSearchChange: (value: string) => void
  propertyOptions: PropertyOption[]
  unitOptions: UnitOption[]
  propertyFilter: string
  onPropertyFilterChange: (value: string) => void
  unitFilter: string
  onUnitFilterChange: (value: string) => void
  severityFilter: string
  onSeverityFilterChange: (value: string) => void
  categoryFilter: string
  onCategoryFilterChange: (value: string) => void
  filtersActive: boolean
  onClearFilters: () => void
  scopeProperty?: ScopedProperty
  onSelect: (t: Ticket) => void
  onNewTicket: () => void
  onMove: (id: string, status: TicketStatus) => void
  openMenuId: string | null
  onToggleMenu: (id: string | null) => void
  busyId: string | null
  moveError: string | null
}

const FilterIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
)

const PlusIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

const SearchIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
)

const XIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

// Mobile counterpart to the desktop 4-column kanban board: a single list
// filtered by a segmented pill control instead of side-by-side columns. All
// state/handlers are owned by the parent TicketBoard and passed in as props
// — this component adds no business logic of its own, just presentation
// plus the mobile-only filter-sheet open/close state.
export default function MobileTicketList({
  tickets,
  activeStatus,
  onChangeStatus,
  search,
  onSearchChange,
  propertyOptions,
  unitOptions,
  propertyFilter,
  onPropertyFilterChange,
  unitFilter,
  onUnitFilterChange,
  severityFilter,
  onSeverityFilterChange,
  categoryFilter,
  onCategoryFilterChange,
  filtersActive,
  onClearFilters,
  scopeProperty,
  onSelect,
  onNewTicket,
  onMove,
  openMenuId,
  onToggleMenu,
  busyId,
  moveError,
}: Props) {
  const [showFilters, setShowFilters] = useState(false)

  const activeColumn = COLUMNS.find((c) => c.key === activeStatus) ?? COLUMNS[0]
  const visible = tickets.filter((t) => activeColumn.statuses.includes(t.status))

  return (
    <div>
      {/* Heading + New Ticket */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold text-[#1e293b]">Request Board</h2>
          <span className="text-sm text-[#7b809a]">{tickets.length} total</span>
        </div>
        <button
          type="button"
          onClick={onNewTicket}
          aria-label="New Ticket"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1565c0] text-white shadow-[var(--shadow-button)]"
        >
          {PlusIcon}
        </button>
      </div>

      {/* Segmented status control */}
      <div className="mb-3 flex items-center gap-1 overflow-x-auto rounded-full bg-[#f0f4f8] p-1">
        {COLUMNS.map((col) => {
          const count = tickets.filter((t) => col.statuses.includes(t.status)).length
          const active = col.key === activeColumn.key
          return (
            <button
              key={col.key}
              type="button"
              onClick={() => onChangeStatus(col.key)}
              aria-pressed={active}
              className={`flex-1 whitespace-nowrap rounded-full px-2.5 py-1.5 text-xs font-semibold transition-colors ${
                active
                  ? 'bg-white text-[#1565c0] shadow-[0_1px_3px_rgba(52,71,103,0.12)]'
                  : 'text-[#7b809a]'
              }`}
            >
              {col.label} <span className="tabular-nums">{count}</span>
            </button>
          )
        })}
      </div>

      {/* Search + Filters */}
      <div className="mb-3 flex items-center gap-2">
        <div className="relative flex-1">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#b0b7c3]">
            {SearchIcon}
          </span>
          <input
            type="search"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search tenants"
            className="w-full rounded-lg border border-[rgba(52,71,103,0.18)] bg-white py-2 pl-8 pr-3 text-sm text-[#1e293b] placeholder:text-[#b0b7c3] focus:border-[#1976d2] focus:outline-none"
          />
        </div>
        <button
          type="button"
          onClick={() => setShowFilters(true)}
          aria-label="Filters"
          className="relative flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-[rgba(52,71,103,0.18)] bg-white text-[#546575]"
        >
          {FilterIcon}
          {filtersActive && (
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#1565c0]" aria-hidden="true" />
          )}
        </button>
      </div>

      {moveError && (
        <p className="mb-3 rounded-lg bg-[#fce8e6] px-3 py-2 text-sm text-[#d93025]">{moveError}</p>
      )}

      {/* List */}
      <div className="flex flex-col gap-2.5 pb-[calc(var(--bottom-nav-height)+1rem)]">
        {visible.length === 0 ? (
          <p className="px-2 py-10 text-center text-sm text-[#b0b7c3]">No tickets</p>
        ) : (
          visible.map((ticket) => (
            <TicketCard
              key={ticket.id}
              ticket={ticket}
              onSelect={onSelect}
              onMove={onMove}
              menuOpen={openMenuId === ticket.id}
              onToggleMenu={onToggleMenu}
              busy={busyId === ticket.id}
            />
          ))
        )}
      </div>

      {/* Filter bottom sheet */}
      {showFilters && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.5)' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowFilters(false)
          }}
        >
          <div className="w-full max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white p-5 shadow-[0_-8px_32px_rgba(52,71,103,0.18)]">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-bold text-[#1e293b]">Filters</h3>
              <button
                type="button"
                onClick={() => setShowFilters(false)}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-[#7b809a] hover:bg-[#f0f4f8]"
              >
                {XIcon}
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {!scopeProperty && (
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wide text-[#7b809a]">Property</span>
                  <select
                    value={propertyFilter}
                    onChange={(e) => onPropertyFilterChange(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[rgba(52,71,103,0.18)] bg-white px-2.5 py-2 text-sm text-[#1e293b] focus:border-[#1976d2] focus:outline-none"
                  >
                    <option value="">All properties</option>
                    {propertyOptions.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </label>
              )}

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-[#7b809a]">Unit</span>
                <select
                  value={unitFilter}
                  onChange={(e) => onUnitFilterChange(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[rgba(52,71,103,0.18)] bg-white px-2.5 py-2 text-sm text-[#1e293b] focus:border-[#1976d2] focus:outline-none"
                >
                  <option value="">All units</option>
                  {unitOptions.map((u) => (
                    <option key={u.id} value={u.id}>
                      {propertyFilter || !u.propertyName ? u.unitNumber : `${u.unitNumber} — ${u.propertyName}`}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-[#7b809a]">Severity</span>
                <select
                  value={severityFilter}
                  onChange={(e) => onSeverityFilterChange(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[rgba(52,71,103,0.18)] bg-white px-2.5 py-2 text-sm text-[#1e293b] focus:border-[#1976d2] focus:outline-none"
                >
                  <option value="">All severities</option>
                  {SEVERITY_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide text-[#7b809a]">Category</span>
                <select
                  value={categoryFilter}
                  onChange={(e) => onCategoryFilterChange(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-[rgba(52,71,103,0.18)] bg-white px-2.5 py-2 text-sm text-[#1e293b] focus:border-[#1976d2] focus:outline-none"
                >
                  <option value="">All categories</option>
                  {MAINTENANCE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{maintenanceCategoryLabel(c)}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="mt-5 flex items-center justify-between gap-2">
              {filtersActive ? (
                <button
                  type="button"
                  onClick={onClearFilters}
                  className="text-sm font-semibold text-[#1565c0]"
                >
                  Clear filters
                </button>
              ) : <span />}
              <button
                type="button"
                onClick={() => setShowFilters(false)}
                className="rounded-lg bg-[#1565c0] px-4 py-2 text-sm font-semibold text-white"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
