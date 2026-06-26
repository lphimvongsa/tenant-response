'use client'

import { useState } from 'react'

export type Ticket = {
  id: string
  category: string | null
  location: string | null
  severity: 'mild' | 'moderate' | 'severe' | null
  description: string | null
  status: 'open' | 'resolved' | 'closed'
  photo_url: string | null
  created_at: string
  tenants: { id: string; name: string | null; phone: string } | null
}

const SEVERITY_STYLES: Record<'mild' | 'moderate' | 'severe', string> = {
  mild: 'bg-[#fef9c3] text-[#854d0e]',
  moderate: 'bg-[#ffedd5] text-[#9a3412]',
  severe: 'bg-[#fee2e2] text-[#b91c1c]',
}

function SeverityBadge({ severity }: { severity: Ticket['severity'] }) {
  if (!severity) {
    return (
      <span className="inline-flex rounded-full bg-[#f0f4f8] px-2.5 py-0.5 text-xs font-semibold text-[#7b809a]">
        unknown
      </span>
    )
  }
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${SEVERITY_STYLES[severity]}`}>
      {severity}
    </span>
  )
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function tenantLabel(tenant: Ticket['tenants']): string {
  if (!tenant) return 'Unknown tenant'
  return tenant.name ? `${tenant.name}` : tenant.phone
}

function tenantPhone(tenant: Ticket['tenants']): string | null {
  return tenant?.phone ?? null
}

// ── Ticket detail modal ────────────────────────────────────────────────────

function TicketModal({ ticket, onClose }: { ticket: Ticket; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(15, 23, 42, 0.5)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-[0_20px_60px_rgba(15,23,42,0.25)]">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[rgba(52,71,103,0.08)] px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-[#344767] capitalize">
              {ticket.category ?? 'Maintenance Request'}
            </h2>
            <p className="mt-0.5 text-sm text-[#7b809a]">
              {ticket.location ?? 'Location not specified'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="ml-4 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-[#7b809a] transition hover:bg-[#f0f4f8] hover:text-[#344767]"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5 space-y-4">
          {/* Badges row */}
          <div className="flex flex-wrap gap-2">
            <SeverityBadge severity={ticket.severity} />
            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
              ticket.status === 'open'
                ? 'bg-[#e8f0fe] text-[#1565c0]'
                : 'bg-[#e6f4ea] text-[#0f9d58]'
            }`}>
              {ticket.status}
            </span>
          </div>

          {/* Tenant */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#7b809a]">Tenant</p>
            <p className="mt-1 text-sm font-medium text-[#344767]">{tenantLabel(ticket.tenants)}</p>
            {tenantPhone(ticket.tenants) && ticket.tenants?.name && (
              <p className="text-sm text-[#7b809a]">{tenantPhone(ticket.tenants)}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[#7b809a]">Description</p>
            <p className="mt-1 text-sm leading-relaxed text-[#344767]">
              {ticket.description ?? 'No description provided.'}
            </p>
          </div>

          {/* Photo */}
          {ticket.photo_url && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#7b809a]">Photo</p>
              <div className="mt-2 overflow-hidden rounded-xl border border-[rgba(52,71,103,0.10)]">
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

          {/* Meta */}
          <div className="flex gap-6 rounded-xl bg-[#f8fafc] px-4 py-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-[#7b809a]">Created</p>
              <p className="mt-0.5 text-sm text-[#344767]">{formatDate(ticket.created_at)}</p>
            </div>
            {ticket.location && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#7b809a]">Location</p>
                <p className="mt-0.5 text-sm text-[#344767]">{ticket.location}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Table ──────────────────────────────────────────────────────────────────

function TicketTable({ tickets, onSelect }: { tickets: Ticket[]; onSelect: (t: Ticket) => void }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-[0_4px_24px_rgba(52,71,103,0.10)]">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-[rgba(52,71,103,0.08)] text-xs uppercase tracking-wide text-[#7b809a]">
              <th className="px-4 py-3 font-semibold">Tenant</th>
              <th className="px-4 py-3 font-semibold">Category</th>
              <th className="px-4 py-3 font-semibold">Location</th>
              <th className="px-4 py-3 font-semibold">Severity</th>
              <th className="px-4 py-3 font-semibold">Description</th>
              <th className="px-4 py-3 font-semibold">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[rgba(52,71,103,0.06)]">
            {tickets.map((ticket) => (
              <tr
                key={ticket.id}
                className="cursor-pointer transition hover:bg-[#f5f8ff]"
                onClick={() => onSelect(ticket)}
              >
                <td className="px-4 py-3 font-medium text-[#344767]">{tenantLabel(ticket.tenants)}</td>
                <td className="px-4 py-3 capitalize text-[#344767]">{ticket.category ?? '—'}</td>
                <td className="px-4 py-3 text-[#7b809a]">{ticket.location ?? '—'}</td>
                <td className="px-4 py-3"><SeverityBadge severity={ticket.severity} /></td>
                <td className="max-w-[280px] px-4 py-3 text-[#7b809a]">
                  <span className="block truncate">{ticket.description ?? '—'}</span>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-[#b0b7c3]">{formatDate(ticket.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main export ────────────────────────────────────────────────────────────

export default function TicketList({
  outstanding,
  completed,
}: {
  outstanding: Ticket[]
  completed: Ticket[]
}) {
  const [selected, setSelected] = useState<Ticket | null>(null)

  return (
    <>
      {/* Outstanding */}
      <section className="mb-9">
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-lg font-semibold text-[#344767]">Outstanding Tickets</h2>
          <span className="rounded-full bg-[#e8f0fe] px-2.5 py-0.5 text-xs font-semibold text-[#1565c0]">
            {outstanding.length}
          </span>
        </div>
        {outstanding.length === 0 ? (
          <div className="rounded-2xl bg-white px-5 py-8 text-center text-sm text-[#b0b7c3] shadow-[0_4px_24px_rgba(52,71,103,0.10)]">
            No outstanding tickets.
          </div>
        ) : (
          <TicketTable tickets={outstanding} onSelect={setSelected} />
        )}
      </section>

      {/* Approved / Resolved */}
      <section>
        <div className="mb-3 flex items-center gap-2">
          <h2 className="text-lg font-semibold text-[#344767]">Approved / Resolved Tickets</h2>
          <span className="rounded-full bg-[#e6f4ea] px-2.5 py-0.5 text-xs font-semibold text-[#0f9d58]">
            {completed.length}
          </span>
        </div>
        {completed.length === 0 ? (
          <div className="rounded-2xl bg-white px-5 py-8 text-center text-sm text-[#b0b7c3] shadow-[0_4px_24px_rgba(52,71,103,0.10)]">
            No resolved tickets yet.
          </div>
        ) : (
          <TicketTable tickets={completed} onSelect={setSelected} />
        )}
      </section>

      {/* Modal */}
      {selected && (
        <TicketModal ticket={selected} onClose={() => setSelected(null)} />
      )}
    </>
  )
}
