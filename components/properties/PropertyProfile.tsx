'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { Property, PropertyUnit, PropertyTenant, TenantDirectoryEntry } from '@/types'
import PropertyPhotoPlaceholder from './PropertyPhotoPlaceholder'
import styles from './PropertyProfile.module.css'

type Props = {
  property: Property
}

const OUTSTANDING_STATUSES = ['open', 'in_progress', 'in_review']

function isOutstanding(status: string): boolean {
  return OUTSTANDING_STATUSES.includes(status)
}

function countOpenTickets(units: PropertyUnit[]): number {
  return units.reduce(
    (sum, u) =>
      sum + (Array.isArray(u.tickets) ? u.tickets.filter((t) => isOutstanding(t.status)).length : 0),
    0,
  )
}

export default function PropertyProfile({ property }: Props) {
  const router = useRouter()

  function refresh() {
    router.refresh()
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <Link href="/dashboard/properties" className={styles.backLink}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          All properties
        </Link>

        <ProfileCard property={property} onRefresh={refresh} />
        <UnitList propertyId={property.id} units={property.units ?? []} onRefresh={refresh} />
      </div>
    </div>
  )
}

// ─── Maintenance status pill ─────────────────────────────────────────────────

function MaintenancePill({ openCount }: { openCount: number }) {
  if (openCount > 0) {
    return (
      <span className={styles.pillAttention}>
        {openCount} open ticket{openCount !== 1 ? 's' : ''}
      </span>
    )
  }
  return <span className={styles.pillClear}>All clear</span>
}

// ─── Profile card (photo, name/address, stats, photo controls, delete) ───────

function ProfileCard({ property, onRefresh }: { property: Property; onRefresh: () => void }) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(property.name)
  const [address, setAddress] = useState(property.address)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState('')

  const units = property.units ?? []
  const unitCount = units.length
  const tenantCount = units.reduce(
    (sum, u) => sum + (Array.isArray(u.tenants) ? u.tenants.length : 0),
    0,
  )
  const openCount = countOpenTickets(units)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch(`/api/properties/${property.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, address }),
    })
    setLoading(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Failed to save')
      return
    }
    setEditing(false)
    onRefresh()
  }

  async function handleDelete() {
    const warning =
      `Permanently delete "${property.name}"?\n\n` +
      `This will also remove all of its units and tenants. This action is forever and cannot be undone.`
    if (!confirm(warning)) return
    await fetch(`/api/properties/${property.id}`, { method: 'DELETE' })
    router.push('/dashboard/properties')
    router.refresh()
  }

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoBusy(true)
    setPhotoError('')
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`/api/properties/${property.id}/photo`, {
      method: 'POST',
      body: formData,
    })
    setPhotoBusy(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setPhotoError(d.error ?? 'Failed to upload photo')
      return
    }
    onRefresh()
  }

  async function handleRemovePhoto() {
    if (!confirm('Remove this property photo?')) return
    setPhotoBusy(true)
    setPhotoError('')
    const res = await fetch(`/api/properties/${property.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photo_url: null }),
    })
    setPhotoBusy(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setPhotoError(d.error ?? 'Failed to remove photo')
      return
    }
    onRefresh()
  }

  return (
    <section className={styles.profileCard}>
      <div className={styles.photoColumn}>
        <div className={styles.photoFrame}>
          {property.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={property.photo_url} alt={property.name} className={styles.photo} />
          ) : (
            <PropertyPhotoPlaceholder className={styles.photo} />
          )}
        </div>

        {editing && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handlePhotoSelect}
              className={styles.hiddenFileInput}
            />
            <div className={styles.photoControls}>
              <button
                type="button"
                className={styles.photoBtn}
                onClick={() => fileInputRef.current?.click()}
                disabled={photoBusy}
              >
                {photoBusy ? 'Working…' : property.photo_url ? 'Change Photo' : 'Upload Photo'}
              </button>
              {property.photo_url && (
                <button
                  type="button"
                  className={styles.removeBtn}
                  onClick={handleRemovePhoto}
                  disabled={photoBusy}
                >
                  Remove
                </button>
              )}
            </div>
            {photoError && <p className={styles.error}>{photoError}</p>}
          </>
        )}
      </div>

      <div className={styles.infoColumn}>
        {editing ? (
          <form onSubmit={handleSave} className={styles.editForm}>
            <input
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Property name"
              required
              autoFocus
            />
            <input
              className={styles.input}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Address"
              required
            />
            <div className={styles.editActions}>
              <button type="button" className={styles.cancelBtn} onClick={() => setEditing(false)}>
                Cancel
              </button>
              <button type="submit" className={styles.saveBtn} disabled={loading}>
                {loading ? 'Saving…' : 'Save'}
              </button>
            </div>
            {error && <p className={styles.error}>{error}</p>}
          </form>
        ) : (
          <div className={styles.infoTop}>
            <div className={styles.infoText}>
              <h1 className={styles.propName}>{property.name}</h1>
              <p className={styles.propAddress}>{property.address}</p>
            </div>
            <button className={styles.editBtn} onClick={() => setEditing(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 20h9" />
                <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
              </svg>
              Edit
            </button>
          </div>
        )}

        <div className={styles.stats}>
          <div className={styles.stat}>
            <span className={styles.statValue}>{unitCount}</span>
            <span className={styles.statLabel}>Unit{unitCount !== 1 ? 's' : ''}</span>
          </div>
          <div className={styles.stat}>
            <span className={styles.statValue}>{tenantCount}</span>
            <span className={styles.statLabel}>Tenant{tenantCount !== 1 ? 's' : ''}</span>
          </div>
          <div className={styles.stat}>
            <MaintenancePill openCount={openCount} />
            <span className={styles.statLabel}>Maintenance</span>
          </div>
        </div>

        {editing && (
          <div className={styles.footerRow}>
            <button className={styles.deleteBtn} onClick={handleDelete}>
              Delete Property
            </button>
          </div>
        )}
      </div>
    </section>
  )
}

// ─── Unit list ───────────────────────────────────────────────────────────────

function UnitList({
  propertyId,
  units,
  onRefresh,
}: {
  propertyId: string
  units: PropertyUnit[]
  onRefresh: () => void
}) {
  const [showAddUnit, setShowAddUnit] = useState(false)
  const [unitNumber, setUnitNumber] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleAddUnit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch(`/api/properties/${propertyId}/units`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unit_number: unitNumber }),
    })
    setLoading(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Failed to add unit')
      return
    }
    setUnitNumber('')
    setShowAddUnit(false)
    onRefresh()
  }

  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Units ({units.length})</h2>
        {!showAddUnit && (
          <button className={styles.addBtn} onClick={() => setShowAddUnit(true)}>
            + Add Unit
          </button>
        )}
      </div>

      {showAddUnit && (
        <form onSubmit={handleAddUnit} className={styles.addUnitForm}>
          <input
            className={styles.input}
            value={unitNumber}
            onChange={(e) => setUnitNumber(e.target.value)}
            placeholder="Unit number (e.g. 101, 2A)"
            required
            autoFocus
          />
          <button type="button" className={styles.cancelBtn} onClick={() => setShowAddUnit(false)}>
            Cancel
          </button>
          <button type="submit" className={styles.saveBtn} disabled={loading}>
            {loading ? 'Adding…' : 'Add Unit'}
          </button>
          {error && <p className={styles.error}>{error}</p>}
        </form>
      )}

      {units.length === 0 && !showAddUnit && (
        <p className={styles.noUnits}>No units yet. Add one to get started.</p>
      )}

      <div className={styles.unitList}>
        {units.map((unit) => (
          <UnitCard key={unit.id} unit={unit} onRefresh={onRefresh} />
        ))}
      </div>
    </section>
  )
}

// ─── Unit card ───────────────────────────────────────────────────────────────

function UnitCard({ unit, onRefresh }: { unit: PropertyUnit; onRefresh: () => void }) {
  const [showAddTenant, setShowAddTenant] = useState(false)
  const [mode, setMode] = useState<'existing' | 'new'>('existing')
  const [phone, setPhone] = useState('')
  const [tenantName, setTenantName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [directory, setDirectory] = useState<TenantDirectoryEntry[] | null>(null)
  const [directoryLoading, setDirectoryLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [assigningId, setAssigningId] = useState<string | null>(null)

  const openCount = Array.isArray(unit.tickets)
    ? unit.tickets.filter((t) => isOutstanding(t.status)).length
    : 0

  function openAddTenant() {
    setShowAddTenant(true)
    if (mode === 'existing' && directory === null) loadDirectory()
  }

  async function loadDirectory() {
    setDirectoryLoading(true)
    const res = await fetch('/api/tenants')
    setDirectoryLoading(false)
    if (!res.ok) {
      setError('Failed to load tenants')
      return
    }
    setDirectory(await res.json())
  }

  function switchMode(next: 'existing' | 'new') {
    setMode(next)
    setError('')
    if (next === 'existing' && directory === null) loadDirectory()
  }

  async function handleAssignExisting(tenant: TenantDirectoryEntry) {
    setAssigningId(tenant.id)
    setError('')
    const res = await fetch(`/api/tenants/${tenant.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ unit_id: unit.id }),
    })
    setAssigningId(null)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Failed to assign tenant')
      return
    }
    setSearch('')
    setDirectory(null)
    setShowAddTenant(false)
    onRefresh()
  }

  async function handleAddTenant(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch(`/api/units/${unit.id}/tenants`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, name: tenantName }),
    })
    setLoading(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Failed to add tenant')
      return
    }
    setPhone('')
    setTenantName('')
    setShowAddTenant(false)
    onRefresh()
  }

  const assignedIds = new Set((unit.tenants ?? []).map((t) => t.id))
  const q = search.trim().toLowerCase()
  const candidates = (directory ?? []).filter((t) => {
    if (assignedIds.has(t.id)) return false
    if (!q) return true
    return (t.name ?? '').toLowerCase().includes(q) || t.phone.toLowerCase().includes(q)
  })

  async function handleDeleteUnit() {
    const label = unit.tenants?.length
      ? `Delete unit ${unit.unit_number} and remove its ${unit.tenants.length} tenant(s)?`
      : `Delete unit ${unit.unit_number}?`
    if (!confirm(label)) return
    await fetch(`/api/units/${unit.id}`, { method: 'DELETE' })
    onRefresh()
  }

  return (
    <div className={styles.unitCard}>
      <div className={styles.unitHeader}>
        <div className={styles.unitHeaderLeft}>
          <span className={styles.unitNumber}>Unit {unit.unit_number}</span>
          {openCount > 0 && (
            <span className={styles.unitTicketBadge}>
              {openCount} open
            </span>
          )}
        </div>
        <button className={styles.deleteBtn} onClick={handleDeleteUnit}>
          Delete unit
        </button>
      </div>

      <div className={styles.tenantList}>
        {(!unit.tenants || unit.tenants.length === 0) && (
          <p className={styles.noTenants}>No tenants assigned.</p>
        )}
        {unit.tenants?.map((tenant) => (
          <TenantRow key={tenant.id} tenant={tenant} onRefresh={onRefresh} />
        ))}
      </div>

      {showAddTenant ? (
        <div className={styles.addTenantForm}>
          <div className={styles.tenantModeTabs}>
            <button
              type="button"
              className={mode === 'existing' ? styles.tenantModeTabActive : styles.tenantModeTab}
              onClick={() => switchMode('existing')}
            >
              Choose existing
            </button>
            <button
              type="button"
              className={mode === 'new' ? styles.tenantModeTabActive : styles.tenantModeTab}
              onClick={() => switchMode('new')}
            >
              New tenant
            </button>
          </div>

          {mode === 'existing' ? (
            <div className={styles.existingTenantPanel}>
              <input
                className={styles.input}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or phone"
                autoFocus
              />
              <div className={styles.tenantOptionList}>
                {directoryLoading && <p className={styles.tenantOptionEmpty}>Loading tenants…</p>}
                {!directoryLoading && candidates.length === 0 && (
                  <p className={styles.tenantOptionEmpty}>
                    {q ? 'No matching tenants.' : 'No other tenants available — add a new one instead.'}
                  </p>
                )}
                {!directoryLoading &&
                  candidates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className={styles.tenantOption}
                      disabled={assigningId !== null}
                      onClick={() => handleAssignExisting(t)}
                    >
                      <span className={styles.tenantOptionInfo}>
                        {t.name && <span className={styles.tenantName}>{t.name}</span>}
                        <span className={styles.tenantPhone}>{t.phone}</span>
                      </span>
                      <span className={styles.tenantOptionMeta}>
                        {assigningId === t.id
                          ? 'Assigning…'
                          : t.units
                            ? `Currently: Unit ${t.units.unit_number}${t.units.properties ? ` · ${t.units.properties.name}` : ''}`
                            : 'Unassigned'}
                      </span>
                    </button>
                  ))}
              </div>
              <div className={styles.addTenantActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowAddTenant(false)}>
                  Cancel
                </button>
              </div>
              {error && <p className={styles.error}>{error}</p>}
            </div>
          ) : (
            <form onSubmit={handleAddTenant} className={styles.newTenantForm}>
              <input
                className={styles.input}
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                placeholder="Name (optional)"
              />
              <input
                className={styles.input}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone number"
                required
              />
              <div className={styles.addTenantActions}>
                <button type="button" className={styles.cancelBtn} onClick={() => setShowAddTenant(false)}>
                  Cancel
                </button>
                <button type="submit" className={styles.saveBtn} disabled={loading}>
                  {loading ? 'Adding…' : 'Add Tenant'}
                </button>
              </div>
              {error && <p className={styles.error}>{error}</p>}
            </form>
          )}
        </div>
      ) : (
        <button className={styles.addTenantBtn} onClick={openAddTenant}>
          + Add Tenant
        </button>
      )}
    </div>
  )
}

// ─── Tenant row ──────────────────────────────────────────────────────────────

function TenantRow({ tenant, onRefresh }: { tenant: PropertyTenant; onRefresh: () => void }) {
  async function handleRemove() {
    const label = tenant.name
      ? `Remove ${tenant.name} (${tenant.phone})?`
      : `Remove tenant ${tenant.phone}?`
    if (!confirm(label)) return
    await fetch(`/api/tenants/${tenant.id}`, { method: 'DELETE' })
    onRefresh()
  }

  return (
    <div className={styles.tenantRow}>
      <div className={styles.tenantInfo}>
        {tenant.name && <span className={styles.tenantName}>{tenant.name}</span>}
        <span className={styles.tenantPhone}>{tenant.phone}</span>
      </div>
      <button className={styles.removeBtn} onClick={handleRemove}>
        Remove
      </button>
    </div>
  )
}
