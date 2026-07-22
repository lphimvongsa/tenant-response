'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  MAINTENANCE_CATEGORIES,
  maintenanceCategoryLabel,
  type MaintenanceCategory,
} from '@/lib/maintenance-categories'
import { useIsMobile } from '@/lib/hooks/useIsMobile'
import MobileTicketList from './MobileTicketList'

// ── Types ────────────────────────────────────────────────────────────────────

export type TicketStatus = 'open' | 'in_progress' | 'in_review' | 'resolved' | 'closed'

export type Ticket = {
  id: string
  title: string | null
  category: string | null
  location: string | null
  severity: 'mild' | 'moderate' | 'severe' | null
  description: string | null
  status: TicketStatus
  photo_url: string | null
  assigned_to: string | null
  created_at: string
  tenants: { id: string; name: string | null; phone: string } | null
  units: { id: string; unit_number: string; properties: { id: string; name: string } | null } | null
}

// ── Board column + status taxonomy ────────────────────────────────────────────

export const COLUMNS: { key: string; label: string; statuses: TicketStatus[] }[] = [
  { key: 'new', label: 'New', statuses: ['open'] },
  { key: 'in_progress', label: 'In Progress', statuses: ['in_progress'] },
  { key: 'in_review', label: 'In Review', statuses: ['in_review'] },
  { key: 'resolved', label: 'Resolved', statuses: ['resolved', 'closed'] },
]

// The 4 statuses a ticket can be moved to via the kebab menu / detail modal.
const STATUS_OPTIONS: { value: TicketStatus; label: string }[] = [
  { value: 'open', label: 'New' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'in_review', label: 'In Review' },
  { value: 'resolved', label: 'Resolved' },
]

function statusLabel(status: TicketStatus): string {
  const match = STATUS_OPTIONS.find((o) => o.value === status)
  if (match) return match.label
  if (status === 'closed') return 'Resolved'
  return status
}

// ── Priority (severity → label + colored dot) ─────────────────────────────────
// Reuses the severity→color language from the old SEVERITY_STYLES, restyled as a
// dot + label badge. null severity is treated as the "Normal" default.

// `text` reads on light surfaces (the ticket detail modal); `glassText` is a
// brightened tint that stays legible on the dark glass board (mirrors how the
// Overview escalated chip pairs a saturated --color-danger dot with #ffb4b4
// text). Severity hues follow the reference: green Mild / amber Moderate / red
// Severe. null severity is treated as the "Moderate" default.
type Priority = { label: string; dot: string; text: string; glassText: string }

const PRIORITY: Record<'mild' | 'moderate' | 'severe', Priority> = {
  mild: { label: 'Mild', dot: 'var(--color-success)', text: 'var(--color-success)', glassText: '#7ee7b0' },
  moderate: { label: 'Moderate', dot: 'var(--color-warning)', text: 'var(--color-warning)', glassText: '#f5c97a' },
  severe: { label: 'Severe', dot: 'var(--color-danger)', text: 'var(--color-danger)', glassText: '#ffb4b4' },
}

export const SEVERITY_OPTIONS: { value: 'mild' | 'moderate' | 'severe'; label: string }[] = [
  { value: 'mild', label: 'Mild' },
  { value: 'moderate', label: 'Moderate' },
  { value: 'severe', label: 'Severe' },
]

// severity is AI-generated free text with no DB-level enum, so it isn't always
// exactly 'mild' | 'moderate' | 'severe' — fall back to showing the raw value.
function priorityOf(severity: Ticket['severity']): Priority {
  if (!severity) return PRIORITY.moderate
  if (PRIORITY[severity]) return PRIORITY[severity]
  return {
    label: severity.charAt(0).toUpperCase() + severity.slice(1),
    dot: 'var(--color-text-muted)',
    text: 'var(--color-text-secondary)',
    glassText: 'var(--color-on-glass-muted)',
  }
}

// `onGlass` switches the badge for a dark glass surface (translucent .glass-chip
// fill + brightened text) vs a light surface (sunken fill + saturated text). Both
// the board card and the (now glass) detail modal render it onGlass; the light
// branch is kept so the badge stays reusable on any future light surface.
function PriorityBadge({ severity, onGlass = false }: { severity: Ticket['severity']; onGlass?: boolean }) {
  const p = priorityOf(severity)
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        onGlass ? 'glass-chip' : '[background:var(--color-bg-sunken)]'
      }`}
      style={{ color: onGlass ? p.glassText : p.text }}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: p.dot }} />
      {p.label}
    </span>
  )
}

// ── Avatar (deterministic color hashed off the assignee name) ─────────────────

const AVATAR_COLORS = ['var(--color-ink)', 'var(--color-success)', 'var(--color-warning)', 'var(--color-danger)', 'var(--color-text-secondary)']

function avatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function AssigneeRow({ assignedTo }: { assignedTo: string | null }) {
  if (!assignedTo || !assignedTo.trim()) {
    return (
      <div className="flex items-center gap-2 text-xs [color:var(--color-on-glass-muted)]">
        <span className="inline-block h-5 w-5 rounded-full border border-dashed [border-color:var(--glass-border-strong)]" />
        Unassigned
      </div>
    )
  }
  const letter = assignedTo.trim().charAt(0).toUpperCase()
  return (
    <div className="flex items-center gap-2 text-xs font-medium [color:var(--color-on-glass)]">
      <span
        className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
        style={{ backgroundColor: avatarColor(assignedTo.trim()) }}
      >
        {letter}
      </span>
      <span className="truncate">{assignedTo}</span>
    </div>
  )
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function ticketRef(id: string): string {
  return `#${id.slice(0, 6).toUpperCase()}`
}

// `title` is a short human-written summary (AI-generated for tenant-reported
// tickets, staff-entered for manual ones). Older tickets predate this column, so
// fall back to deriving one from the free-text description, then category.
function ticketTitle(ticket: Ticket): string {
  if (ticket.title?.trim()) return ticket.title.trim()
  // Older tickets had "| Severity: ..." folded into the description before severity
  // became its own field — strip it so legacy tickets render cleanly too.
  const summary = ticket.description?.replace(/\s*\|\s*Severity:\s*\S+\s*$/i, '').trim()
  if (summary) return summary.length > 64 ? `${summary.slice(0, 61)}…` : summary
  if (ticket.category?.trim()) return maintenanceCategoryLabel(ticket.category)
  return 'Maintenance Request'
}

function propertyName(ticket: Ticket): string {
  return ticket.units?.properties?.name ?? 'Unassigned property'
}

function tenantLabel(tenant: Ticket['tenants']): string {
  if (!tenant) return 'Unknown tenant'
  return tenant.name ? tenant.name : tenant.phone
}

// ── Kebab menu (move ticket to another status) ────────────────────────────────

function KebabMenu({
  ticket,
  open,
  onToggle,
  onMove,
  busy,
}: {
  ticket: Ticket
  open: boolean
  onToggle: () => void
  onMove: (status: TicketStatus) => void
  busy: boolean
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onToggle()
        }}
        className="flex h-6 w-6 items-center justify-center rounded-md [color:var(--color-on-glass-muted)] transition hover:bg-white/10 hover:[color:var(--color-on-glass)]"
        aria-label="Ticket actions"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="19" cy="12" r="1.6" />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-7 z-20 w-40 overflow-hidden rounded-lg border [border-color:var(--glass-border)] [background:rgba(36,28,84,0.92)] py-1 shadow-[var(--glass-shadow)] backdrop-blur-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide [color:var(--color-on-glass-subtle)]">Move to</p>
          {STATUS_OPTIONS.map((opt) => {
            const isCurrent =
              opt.value === ticket.status ||
              (opt.value === 'resolved' && ticket.status === 'closed')
            return (
              <button
                key={opt.value}
                type="button"
                role="menuitem"
                disabled={isCurrent || busy}
                onClick={() => onMove(opt.value)}
                className="flex w-full items-center justify-between px-3 py-1.5 text-left text-sm [color:var(--color-on-glass)] transition hover:bg-white/10 disabled:cursor-default disabled:[color:var(--color-on-glass-subtle)] disabled:hover:bg-transparent"
              >
                {opt.label}
                {isCurrent && <span className="text-[10px] [color:var(--color-on-glass-subtle)]">current</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Ticket card ───────────────────────────────────────────────────────────────

export function TicketCard({
  ticket,
  onSelect,
  onMove,
  menuOpen,
  onToggleMenu,
  busy,
}: {
  ticket: Ticket
  onSelect: (t: Ticket) => void
  onMove: (id: string, status: TicketStatus) => void
  menuOpen: boolean
  onToggleMenu: (id: string | null) => void
  busy: boolean
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(ticket)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect(ticket)
        }
      }}
      className="glass-panel glass-interactive w-full cursor-pointer p-3 text-left"
    >
      <div className="mb-1.5 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-semibold [color:var(--color-on-glass-subtle)]">
          {ticketRef(ticket.id)}
          {ticket.photo_url && (
            <svg
              width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              aria-label="Photo attached"
            >
              <title>Photo attached</title>
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
              <circle cx="12" cy="13" r="4" />
            </svg>
          )}
        </span>
        <KebabMenu
          ticket={ticket}
          open={menuOpen}
          onToggle={() => onToggleMenu(menuOpen ? null : ticket.id)}
          onMove={(status) => onMove(ticket.id, status)}
          busy={busy}
        />
      </div>

      <p className="line-clamp-2 text-sm font-bold [color:var(--color-on-glass)]">{ticketTitle(ticket)}</p>
      <p className="mt-0.5 truncate text-xs [color:var(--color-on-glass-muted)]">{propertyName(ticket)}</p>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <PriorityBadge severity={ticket.severity} onGlass />
        {ticket.category?.trim() && (
          <span className="glass-chip inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold [color:var(--color-on-glass-muted)]">
            {maintenanceCategoryLabel(ticket.category)}
          </span>
        )}
      </div>

      <div className="mt-3 border-t [border-color:var(--glass-border)] pt-2.5">
        <AssigneeRow assignedTo={ticket.assigned_to} />
      </div>
    </div>
  )
}

// ── Board column ──────────────────────────────────────────────────────────────

function BoardColumn({
  label,
  tickets,
  onSelect,
  onMove,
  openMenuId,
  onToggleMenu,
  busyId,
}: {
  label: string
  tickets: Ticket[]
  onSelect: (t: Ticket) => void
  onMove: (id: string, status: TicketStatus) => void
  openMenuId: string | null
  onToggleMenu: (id: string | null) => void
  busyId: string | null
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="mb-3 flex items-center gap-2">
        <h3 className="text-xs font-semibold uppercase tracking-wide [color:var(--color-on-glass-muted)]">{label}</h3>
        <span className="glass-chip rounded-full px-2 py-0.5 text-xs font-semibold [color:var(--color-on-glass-muted)]">
          {tickets.length}
        </span>
      </div>
      <div className="flex max-h-[calc(100vh-260px)] flex-col gap-2.5 overflow-y-auto rounded-[var(--radius-lg)] [background:rgba(255,255,255,0.04)] p-2.5">
        {tickets.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs [color:var(--color-on-glass-subtle)]">No tickets</p>
        ) : (
          tickets.map((ticket) => (
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
    </div>
  )
}

// ── Ticket detail modal (extended: property, unit, editable assignee + status) ─

function TicketModal({
  ticket,
  onClose,
  onSaved,
}: {
  ticket: Ticket
  onClose: () => void
  onSaved: () => void
}) {
  const [status, setStatus] = useState<TicketStatus>(
    ticket.status === 'closed' ? 'resolved' : ticket.status,
  )
  const [assignedTo, setAssignedTo] = useState(ticket.assigned_to ?? '')
  const [title, setTitle] = useState(ticket.title ?? '')
  const [category, setCategory] = useState(ticket.category?.toLowerCase() ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const dirty =
    status !== (ticket.status === 'closed' ? 'resolved' : ticket.status) ||
    assignedTo.trim() !== (ticket.assigned_to ?? '') ||
    title.trim() !== (ticket.title ?? '') ||
    category !== (ticket.category?.toLowerCase() ?? '')

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/tickets/${ticket.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          assigned_to: assignedTo.trim() || null,
          title: title.trim() || null,
          category: category || null,
        }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error ?? 'Failed to update ticket')
      }
      onSaved()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update ticket')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 md:items-center md:p-4"
      style={{ backgroundColor: 'var(--color-overlay)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="relative max-h-[92vh] w-full max-w-lg overflow-hidden rounded-t-[var(--radius-xl)] border [border-color:var(--glass-border-strong)] [background:var(--glass-bg-strong)] shadow-[var(--glass-shadow)] backdrop-blur-[var(--glass-blur)] md:max-h-none md:rounded-[var(--radius-xl)]">
        {/* Header */}
        <div className="flex items-start justify-between border-b [border-color:var(--glass-border)] px-6 py-4">
          <div>
            <p className="text-xs font-semibold [color:var(--color-on-glass-muted)]">{ticketRef(ticket.id)}</p>
            <h2 className="mt-0.5 text-base font-bold [color:var(--color-on-glass)]">{ticketTitle(ticket)}</h2>
            <p className="mt-0.5 text-sm [color:var(--color-on-glass-muted)]">{propertyName(ticket)}</p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg [color:var(--color-on-glass-muted)] transition hover:bg-white/10 hover:[color:var(--color-on-glass)]"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[calc(92vh-160px)] space-y-4 overflow-y-auto px-6 py-5 md:max-h-[70vh]">
          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-2">
            <PriorityBadge severity={ticket.severity} onGlass />
            <span className="glass-chip inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold [color:var(--color-on-glass)]">
              {statusLabel(ticket.status)}
            </span>
          </div>

          {/* Property / Unit / Tenant */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide [color:var(--color-on-glass-muted)]">Property</p>
              <p className="mt-1 text-sm font-medium [color:var(--color-on-glass)]">{propertyName(ticket)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide [color:var(--color-on-glass-muted)]">Unit</p>
              <p className="mt-1 text-sm font-medium [color:var(--color-on-glass)]">
                {ticket.units?.unit_number ?? '—'}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide [color:var(--color-on-glass-muted)]">Tenant</p>
              <p className="mt-1 text-sm font-medium [color:var(--color-on-glass)]">{tenantLabel(ticket.tenants)}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide [color:var(--color-on-glass-muted)]">Created</p>
              <p className="mt-1 text-sm font-medium [color:var(--color-on-glass)]">{formatDate(ticket.created_at)}</p>
            </div>
          </div>

          {/* Description */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide [color:var(--color-on-glass-muted)]">Description</p>
            <p className="mt-1 text-sm leading-relaxed [color:var(--color-on-glass)]">
              {ticket.description ?? 'No description provided.'}
            </p>
          </div>

          {/* Photo */}
          {ticket.photo_url && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide [color:var(--color-on-glass-muted)]">Photo</p>
              <div className="mt-2 overflow-hidden rounded-xl border [border-color:var(--glass-border)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={ticket.photo_url}
                  alt="Maintenance photo"
                  className="w-full object-cover"
                  style={{ maxHeight: '300px' }}
                />
              </div>
            </div>
          )}

          {/* Editable title / category / status / assignee */}
          <div className="glass-chip space-y-3 rounded-xl px-4 py-3">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide [color:var(--color-on-glass-muted)]">Title</span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Short summary"
                className={`mt-1 w-full px-4 py-2 ${glassInputClass}`}
              />
            </label>
            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide [color:var(--color-on-glass-muted)]">Category</span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className={`mt-1 w-full ${glassSelectClass}`}
                >
                  <option value="">—</option>
                  {MAINTENANCE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {maintenanceCategoryLabel(c)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide [color:var(--color-on-glass-muted)]">Status</span>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TicketStatus)}
                  className={`mt-1 w-full ${glassSelectClass}`}
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide [color:var(--color-on-glass-muted)]">Assigned to</span>
              <input
                type="text"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                placeholder="Unassigned"
                className={`mt-1 w-full px-4 py-2 ${glassInputClass}`}
              />
            </label>
          </div>

          {error && <p className={glassErrorClass}>{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 border-t [border-color:var(--glass-border)] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-semibold [color:var(--color-on-glass-muted)] transition hover:bg-white/10 hover:[color:var(--color-on-glass)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirty || saving}
            className="rounded-lg [background:var(--color-lavender-300)] px-4 py-2 text-sm font-semibold [color:var(--color-ink)] shadow-[var(--glass-shadow)] transition hover:[background:var(--color-lavender-200)] disabled:cursor-default disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── New ticket modal ──────────────────────────────────────────────────────────

type PropertyOption = {
  id: string
  name: string
  units: { id: string; unit_number: string }[] | null
}

// When set, the board (and this modal) is scoped to a single property: the
// property picker is hidden/locked and only that property's units are offered.
export type ScopedProperty = {
  id: string
  name: string
  units: { id: string; unit_number: string }[]
}

function NewTicketModal({
  onClose,
  onSaved,
  scopedProperty,
}: {
  onClose: () => void
  onSaved: () => void
  scopedProperty?: ScopedProperty
}) {
  const [properties, setProperties] = useState<PropertyOption[] | null>(
    scopedProperty ? [scopedProperty] : null,
  )
  const [loadError, setLoadError] = useState<string | null>(null)

  const [propertyId, setPropertyId] = useState(scopedProperty?.id ?? '')
  const [unitId, setUnitId] = useState('')
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<MaintenanceCategory | ''>('')
  const [description, setDescription] = useState('')
  const [severity, setSeverity] = useState<'mild' | 'moderate' | 'severe'>('moderate')
  const [assignedTo, setAssignedTo] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    if (scopedProperty) return  // units are already known — no fetch needed
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/properties')
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null
          throw new Error(data?.error ?? 'Failed to load properties')
        }
        const data = (await res.json()) as PropertyOption[]
        if (!cancelled) setProperties(data)
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err.message : 'Failed to load properties')
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [scopedProperty])

  const selectedProperty = properties?.find((p) => p.id === propertyId) ?? null
  const units = selectedProperty?.units ?? []

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!unitId || !title.trim() || !description.trim()) {
      setSubmitError('Unit, title, and description are required.')
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          unit_id: unitId,
          title: title.trim(),
          category: category || null,
          severity,
          description: description.trim(),
          assigned_to: assignedTo.trim() || null,
        }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error ?? 'Failed to create ticket')
      }
      onSaved()
      onClose()
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to create ticket')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 md:items-center md:p-4"
      style={{ backgroundColor: 'var(--color-overlay)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="relative max-h-[92vh] w-full max-w-lg overflow-hidden rounded-t-[var(--radius-xl)] border [border-color:var(--glass-border-strong)] [background:var(--glass-bg-strong)] shadow-[var(--glass-shadow)] backdrop-blur-[var(--glass-blur)] md:max-h-none md:rounded-[var(--radius-xl)]">
        <div className="flex items-center justify-between border-b [border-color:var(--glass-border)] px-6 py-4">
          <h2 className="text-base font-bold [color:var(--color-on-glass)]">New Ticket</h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg [color:var(--color-on-glass-muted)] transition hover:bg-white/10 hover:[color:var(--color-on-glass)]"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {loadError ? (
          <div className="px-6 py-8">
            <p className={glassErrorClass}>{loadError}</p>
          </div>
        ) : properties === null ? (
          <div className="px-6 py-10 text-center text-sm [color:var(--color-on-glass-muted)]">Loading properties…</div>
        ) : (
          <form onSubmit={handleSubmit} className="max-h-[calc(92vh-72px)] space-y-4 overflow-y-auto px-6 py-5 md:max-h-[70vh]">
            {scopedProperty ? (
              <div className="block">
                <span className="text-xs font-semibold uppercase tracking-wide [color:var(--color-on-glass-muted)]">Property</span>
                <p className="mt-1 text-sm font-medium [color:var(--color-on-glass)]">{scopedProperty.name}</p>
              </div>
            ) : (
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide [color:var(--color-on-glass-muted)]">Property</span>
                <select
                  value={propertyId}
                  onChange={(e) => {
                    setPropertyId(e.target.value)
                    setUnitId('')
                  }}
                  className={`mt-1 w-full ${glassSelectClass}`}
                >
                  <option value="">Select a property…</option>
                  {properties.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide [color:var(--color-on-glass-muted)]">Unit</span>
              <select
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                disabled={!selectedProperty}
                className={`mt-1 w-full disabled:cursor-not-allowed disabled:[color:var(--color-on-glass-subtle)] disabled:opacity-60 ${glassSelectClass}`}
              >
                <option value="">{selectedProperty ? 'Select a unit…' : 'Select a property first'}</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.unit_number}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide [color:var(--color-on-glass-muted)]">
                Title <span className="[color:#ffb4b4]">*</span>
              </span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="e.g. Leaking faucet"
                className={`mt-1 w-full px-4 py-2 ${glassInputClass}`}
              />
            </label>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide [color:var(--color-on-glass-muted)]">Category</span>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as MaintenanceCategory | '')}
                className={`mt-1 w-full ${glassSelectClass}`}
              >
                <option value="">Select a category…</option>
                {MAINTENANCE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {maintenanceCategoryLabel(c)}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide [color:var(--color-on-glass-muted)]">
                Description <span className="[color:#ffb4b4]">*</span>
              </span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                rows={3}
                placeholder="Describe the issue…"
                className={`mt-1 ${glassTextareaClass}`}
              />
            </label>

            <div className="grid grid-cols-2 gap-4">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide [color:var(--color-on-glass-muted)]">Priority</span>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as 'mild' | 'moderate' | 'severe')}
                  className={`mt-1 w-full ${glassSelectClass}`}
                >
                  <option value="mild">Low</option>
                  <option value="moderate">Normal</option>
                  <option value="severe">High</option>
                </select>
              </label>
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wide [color:var(--color-on-glass-muted)]">Assigned to</span>
                <input
                  type="text"
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  placeholder="Optional"
                  className={`mt-1 w-full px-4 py-2 ${glassInputClass}`}
                />
              </label>
            </div>

            {submitError && <p className={glassErrorClass}>{submitError}</p>}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm font-semibold [color:var(--color-on-glass-muted)] transition hover:bg-white/10 hover:[color:var(--color-on-glass)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded-lg [background:var(--color-lavender-300)] px-4 py-2 text-sm font-semibold [color:var(--color-ink)] shadow-[var(--glass-shadow)] transition hover:[background:var(--color-lavender-200)] disabled:cursor-default disabled:opacity-50"
              >
                {submitting ? 'Creating…' : 'Create ticket'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ── Board (default export) ─────────────────────────────────────────────────────

function matchesSearch(ticket: Ticket, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  const haystack = [
    ticket.tenants?.name,
    ticket.tenants?.phone,
    ticket.title,
    ticket.category,
    propertyName(ticket),
    ticket.assigned_to,
    ticketRef(ticket.id),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
  return haystack.includes(q)
}

// ── Glass toolbar controls ─────────────────────────────────────────────────────
// Translucent pill inputs/selects that sit directly on the gradient (the desktop
// toolbar). Follows the form-control-on-glass conventions established by the
// Settings pass (see agent memory): glass-bg-strong fill, glass-border-strong,
// lavender focus ring via --shadow-focus, and a dark on-theme <option> popup so
// the native dropdown list stays readable.
export const glassInputClass =
  'rounded-full border [border-color:var(--glass-border-strong)] [background:var(--glass-bg-strong)] backdrop-blur-md text-base [color:var(--color-on-glass)] placeholder:[color:var(--color-on-glass-subtle)] transition focus:[border-color:var(--color-lavender-300)] focus:shadow-[var(--shadow-focus)] focus:outline-none'

export const glassSelectClass =
  'rounded-full border [border-color:var(--glass-border-strong)] [background:var(--glass-bg-strong)] backdrop-blur-md px-3.5 py-1.5 text-base font-medium [color:var(--color-on-glass)] transition [&>option]:[background:var(--color-ink)] [&>option]:[color:var(--color-on-glass)] focus:[border-color:var(--color-lavender-300)] focus:shadow-[var(--shadow-focus)] focus:outline-none'

// Multi-line variant of glassInputClass for modal <textarea>s — same on-glass
// token treatment (glass-bg-strong fill, glass-border-strong, on-glass text,
// lavender --shadow-focus ring) but a rounded rectangle instead of a pill, since
// a rounded-full multi-line field is unusable.
const glassTextareaClass =
  'w-full resize-none rounded-[var(--radius-md)] border [border-color:var(--glass-border-strong)] [background:var(--glass-bg-strong)] backdrop-blur-md px-4 py-2 text-base [color:var(--color-on-glass)] placeholder:[color:var(--color-on-glass-subtle)] transition focus:[border-color:var(--color-lavender-300)] focus:shadow-[var(--shadow-focus)] focus:outline-none'

// Inline error banner on the glass board (matches the Overview error card:
// translucent danger fill + brightened light-red text).
export const glassErrorClass =
  'rounded-[var(--radius-md)] border [border-color:rgba(255,180,180,0.4)] [background:rgba(214,69,69,0.14)] px-3 py-2 text-sm [color:#ffb4b4]'

export default function TicketBoard({
  tickets,
  scopeProperty,
}: {
  tickets: Ticket[]
  // When set, the board is scoped to a single property: the property filter is
  // hidden and "New Ticket" skips property selection, offering only its units.
  scopeProperty?: ScopedProperty
}) {
  const router = useRouter()
  const isMobile = useIsMobile()
  // Which pill is active in the mobile segmented control — unused on desktop.
  const [activeStatus, setActiveStatus] = useState<string>('new')
  const [selected, setSelected] = useState<Ticket | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [search, setSearch] = useState('')
  const [propertyFilter, setPropertyFilter] = useState('')
  const [unitFilter, setUnitFilter] = useState('')
  const [severityFilter, setSeverityFilter] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [moveError, setMoveError] = useState<string | null>(null)
  const boardRef = useRef<HTMLDivElement>(null)

  // Close any open kebab menu when clicking outside the board.
  useEffect(() => {
    if (!openMenuId) return
    function onDocClick(e: MouseEvent) {
      if (boardRef.current && !boardRef.current.contains(e.target as Node)) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [openMenuId])

  // Filter option lists are derived from the tickets actually on the board, so a
  // property/unit only shows up as a filter once it has a ticket.
  const propertyOptions = useMemo(() => {
    const byId = new Map<string, string>()
    for (const t of tickets) {
      const p = t.units?.properties
      if (p) byId.set(p.id, p.name)
    }
    return Array.from(byId, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [tickets])

  const unitOptions = useMemo(() => {
    const byId = new Map<string, { unitNumber: string; propertyName: string | null }>()
    for (const t of tickets) {
      if (!t.units) continue
      if (propertyFilter && t.units.properties?.id !== propertyFilter) continue
      byId.set(t.units.id, {
        unitNumber: t.units.unit_number,
        propertyName: t.units.properties?.name ?? null,
      })
    }
    return Array.from(byId, ([id, v]) => ({ id, ...v })).sort((a, b) =>
      a.unitNumber.localeCompare(b.unitNumber),
    )
  }, [tickets, propertyFilter])

  // Reset the unit filter if it no longer belongs to the selected property.
  useEffect(() => {
    if (unitFilter && !unitOptions.some((u) => u.id === unitFilter)) {
      setUnitFilter('')
    }
  }, [unitOptions, unitFilter])

  const filtered = tickets.filter((t) => {
    if (!matchesSearch(t, search)) return false
    if (propertyFilter && t.units?.properties?.id !== propertyFilter) return false
    if (unitFilter && t.units?.id !== unitFilter) return false
    if (severityFilter && t.severity !== severityFilter) return false
    if (categoryFilter && t.category?.toLowerCase() !== categoryFilter) return false
    return true
  })

  const filtersActive = Boolean(propertyFilter || unitFilter || severityFilter || categoryFilter)

  function clearFilters() {
    setPropertyFilter('')
    setUnitFilter('')
    setSeverityFilter('')
    setCategoryFilter('')
  }

  async function handleMove(id: string, status: TicketStatus) {
    setOpenMenuId(null)
    setBusyId(id)
    setMoveError(null)
    try {
      const res = await fetch(`/api/tickets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error ?? 'Failed to move ticket')
      }
      router.refresh()
    } catch (err) {
      setMoveError(err instanceof Error ? err.message : 'Failed to move ticket')
    } finally {
      setBusyId(null)
    }
  }

  if (isMobile) {
    return (
      <div ref={boardRef}>
        <MobileTicketList
          tickets={filtered}
          activeStatus={activeStatus}
          onChangeStatus={setActiveStatus}
          search={search}
          onSearchChange={setSearch}
          propertyOptions={propertyOptions}
          unitOptions={unitOptions}
          propertyFilter={propertyFilter}
          onPropertyFilterChange={setPropertyFilter}
          unitFilter={unitFilter}
          onUnitFilterChange={setUnitFilter}
          severityFilter={severityFilter}
          onSeverityFilterChange={setSeverityFilter}
          categoryFilter={categoryFilter}
          onCategoryFilterChange={setCategoryFilter}
          filtersActive={filtersActive}
          onClearFilters={clearFilters}
          scopeProperty={scopeProperty}
          onSelect={(t) => {
            setOpenMenuId(null)
            setSelected(t)
          }}
          onNewTicket={() => setShowNew(true)}
          onMove={handleMove}
          openMenuId={openMenuId}
          onToggleMenu={setOpenMenuId}
          busyId={busyId}
          moveError={moveError}
        />

        {selected && (
          <TicketModal
            ticket={selected}
            onClose={() => setSelected(null)}
            onSaved={() => router.refresh()}
          />
        )}

        {showNew && (
          <NewTicketModal
            onClose={() => setShowNew(false)}
            onSaved={() => router.refresh()}
            scopedProperty={scopeProperty}
          />
        )}
      </div>
    )
  }

  return (
    <div ref={boardRef}>
      {/* Request Board heading + search + new ticket */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-bold [color:var(--color-on-glass)]">Request Board</h2>
          <span className="text-sm [color:var(--color-on-glass-muted)]">{filtered.length} total</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <svg
              className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 [color:var(--color-on-glass-subtle)]"
              width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tenants"
              className={`w-56 py-2 pl-8 pr-3 ${glassInputClass}`}
            />
          </div>
          <button
            type="button"
            onClick={() => setShowNew(true)}
            className="whitespace-nowrap rounded-full [background:var(--color-lavender-300)] px-4 py-2 text-sm font-semibold [color:var(--color-ink)] shadow-[var(--glass-shadow)] transition hover:[background:var(--color-lavender-200)]"
          >
            New Ticket
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {!scopeProperty && (
          <select
            value={propertyFilter}
            onChange={(e) => setPropertyFilter(e.target.value)}
            className={glassSelectClass}
          >
            <option value="">All properties</option>
            {propertyOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        )}
        <select
          value={unitFilter}
          onChange={(e) => setUnitFilter(e.target.value)}
          className={glassSelectClass}
        >
          <option value="">All units</option>
          {unitOptions.map((u) => (
            <option key={u.id} value={u.id}>
              {propertyFilter || !u.propertyName ? u.unitNumber : `${u.unitNumber} — ${u.propertyName}`}
            </option>
          ))}
        </select>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
          className={glassSelectClass}
        >
          <option value="">All severities</option>
          {SEVERITY_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className={glassSelectClass}
        >
          <option value="">All categories</option>
          {MAINTENANCE_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {maintenanceCategoryLabel(c)}
            </option>
          ))}
        </select>
        {filtersActive && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-xs font-semibold [color:var(--chart-line-secondary)] transition hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {moveError && (
        <p className={`mb-3 ${glassErrorClass}`}>{moveError}</p>
      )}

      {/* Columns */}
      <div className="flex gap-4">
        {COLUMNS.map((col) => (
          <BoardColumn
            key={col.key}
            label={col.label}
            tickets={filtered.filter((t) => col.statuses.includes(t.status))}
            onSelect={(t) => {
              setOpenMenuId(null)
              setSelected(t)
            }}
            onMove={handleMove}
            openMenuId={openMenuId}
            onToggleMenu={setOpenMenuId}
            busyId={busyId}
          />
        ))}
      </div>

      {selected && (
        <TicketModal
          ticket={selected}
          onClose={() => setSelected(null)}
          onSaved={() => router.refresh()}
        />
      )}

      {showNew && (
        <NewTicketModal
          onClose={() => setShowNew(false)}
          onSaved={() => router.refresh()}
          scopedProperty={scopeProperty}
        />
      )}
    </div>
  )
}
