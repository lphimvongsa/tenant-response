'use client'

import { useState } from 'react'
import type { Property } from '@/types'
import PropertyPhotoPlaceholder from './PropertyPhotoPlaceholder'
import EditPropertyModal from './EditPropertyModal'
import { countOpenTickets } from './ticketStatus'
import { photoFrameClass, photoClass } from './propertyStyles'

const editBtnClass =
  'inline-flex items-center gap-1.5 shrink-0 py-[0.4rem] px-3.5 text-[0.8125rem] font-medium text-text-secondary border-[1.5px] border-border rounded-pill cursor-pointer [transition:color_0.15s,border-color_0.15s] hover:text-ink hover:border-border-strong'

const statClass =
  'flex flex-col gap-[0.35rem] py-3 px-4 bg-bg-sunken border border-border-subtle rounded-md min-w-[96px]'
const statValueClass = 'text-[1.375rem] font-bold text-text-primary leading-none'
const statLabelClass =
  'text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-text-muted'

const locationLineClass = 'text-[0.9375rem] text-text-secondary'
const pillBase =
  'inline-flex self-start py-1 px-2.5 text-xs font-semibold rounded-pill whitespace-nowrap'

// ─── Maintenance status pill ─────────────────────────────────────────────────

function MaintenancePill({ openCount }: { openCount: number }) {
  if (openCount > 0) {
    return (
      <span className={`${pillBase} bg-warning-bg text-warning`}>
        {openCount} open ticket{openCount !== 1 ? 's' : ''}
      </span>
    )
  }
  return <span className={`${pillBase} bg-success-bg text-success`}>All clear</span>
}

// ─── Location formatting ─────────────────────────────────────────────────────

function formatCityStateZip(property: Property): string {
  const cityState = [property.city, property.state].filter(Boolean).join(', ')
  return [cityState, property.zip].filter(Boolean).join(' ')
}

// ─── Profile card (photo, name/address, stats, edit trigger) ────────────────

export default function ProfileCard({
  property,
  onRefresh,
}: {
  property: Property
  onRefresh: () => void
}) {
  const [editing, setEditing] = useState(false)

  const units = property.units ?? []
  const unitCount = units.length
  const tenantCount = units.reduce(
    (sum, u) => sum + (Array.isArray(u.tenants) ? u.tenants.length : 0),
    0,
  )
  const openCount = countOpenTickets(units)
  const location = formatCityStateZip(property)

  return (
    <section className="flex flex-col gap-6 bg-bg-surface border border-border rounded-lg p-6 shadow-card md:flex-row">
      <div className="flex flex-col gap-3 w-full shrink-0 md:w-[300px]">
        <div className={photoFrameClass}>
          {property.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={property.photo_url} alt={property.name} className={photoClass} />
          ) : (
            <PropertyPhotoPlaceholder className={photoClass} />
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col gap-5 min-w-0">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1 min-w-0">
            <h1 className="text-lg font-bold text-text-primary tracking-[-0.02em] leading-[1.2]">{property.name}</h1>
            <p className={locationLineClass}>{property.address}</p>
            {location && <p className={locationLineClass}>{location}</p>}
            {property.country && <p className={locationLineClass}>{property.country}</p>}
          </div>
          <button className={editBtnClass} onClick={() => setEditing(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
            Edit
          </button>
        </div>

        <div className="flex gap-3 flex-wrap">
          <div className={statClass}>
            <span className={statValueClass}>{unitCount}</span>
            <span className={statLabelClass}>Unit{unitCount !== 1 ? 's' : ''}</span>
          </div>
          <div className={statClass}>
            <span className={statValueClass}>{tenantCount}</span>
            <span className={statLabelClass}>Tenant{tenantCount !== 1 ? 's' : ''}</span>
          </div>
          <div className={statClass}>
            <MaintenancePill openCount={openCount} />
            <span className={statLabelClass}>Maintenance</span>
          </div>
        </div>
      </div>

      {editing && (
        <EditPropertyModal
          property={property}
          onClose={() => setEditing(false)}
          onRefresh={onRefresh}
        />
      )}
    </section>
  )
}
