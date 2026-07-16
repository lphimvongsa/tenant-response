'use client'

import { useState } from 'react'
import type { PropertyUnit, PropertyTenant, TenantDirectoryEntry } from '@/types'
import { isOutstanding } from './ticketStatus'
import {
  sectionClass,
  inputClass,
  saveBtnClass,
  cancelBtnClass,
  deleteBtnClass,
  removeBtnClass,
  errorClass,
} from './propertyStyles'

// Dashed "add" pill (formerly .addBtn).
const addBtnClass =
  'py-[0.35rem] px-3.5 text-xs font-semibold text-ink border-[1.5px] border-dashed border-border-strong rounded-pill cursor-pointer [transition:background-color_0.15s,border-color_0.15s] hover:bg-bg-sunken hover:border-ink'
// Smaller dashed "add tenant" pill (formerly .addTenantBtn — no font-weight).
const addTenantBtnClass =
  'self-start py-1 px-2.5 text-xs text-ink border-[1.5px] border-dashed border-border-strong rounded-pill cursor-pointer [transition:background-color_0.15s] hover:bg-bg-sunken'

// Existing / new tenant mode tabs (formerly .tenantModeTab / .tenantModeTabActive).
const tenantModeTabBase =
  'py-[0.3rem] px-3 text-xs font-semibold rounded-pill cursor-pointer border-[1.5px] [transition:color_0.15s,background-color_0.15s,border-color_0.15s]'
const tenantModeTabInactive = `${tenantModeTabBase} text-text-secondary bg-bg-surface border-border hover:text-text-primary`
const tenantModeTabActive = `${tenantModeTabBase} text-ink bg-bg-sunken border-border-strong`

const tenantNameClass = 'text-[0.8125rem] font-medium text-text-primary'
const tenantPhoneClass = 'text-xs text-text-secondary'

// ─── Unit list ───────────────────────────────────────────────────────────────

export default function UnitList({
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
    <section className={sectionClass}>
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">Units ({units.length})</h2>
        {!showAddUnit && (
          <button className={addBtnClass} onClick={() => setShowAddUnit(true)}>
            + Add Unit
          </button>
        )}
      </div>

      {showAddUnit && (
        <form onSubmit={handleAddUnit} className="flex items-center gap-2 flex-wrap">
          <input
            className={inputClass}
            value={unitNumber}
            onChange={(e) => setUnitNumber(e.target.value)}
            placeholder="Unit number (e.g. 101, 2A)"
            required
            autoFocus
          />
          <button type="button" className={cancelBtnClass} onClick={() => setShowAddUnit(false)}>
            Cancel
          </button>
          <button type="submit" className={saveBtnClass} disabled={loading}>
            {loading ? 'Adding…' : 'Add Unit'}
          </button>
          {error && <p className={errorClass}>{error}</p>}
        </form>
      )}

      {units.length === 0 && !showAddUnit && (
        <p className="text-sm text-text-muted">No units yet. Add one to get started.</p>
      )}

      <div className="flex flex-col gap-3.5">
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
    <div className="bg-bg-sunken border border-border-subtle rounded-md py-4 px-[1.125rem] flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[0.9375rem] font-semibold text-text-primary">Unit {unit.unit_number}</span>
          {openCount > 0 && (
            <span className="inline-flex py-0.5 px-2 text-[0.6875rem] font-semibold rounded-pill bg-warning-bg text-warning">
              {openCount} open
            </span>
          )}
        </div>
        <button className={deleteBtnClass} onClick={handleDeleteUnit}>
          Delete unit
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        {(!unit.tenants || unit.tenants.length === 0) && (
          <p className="text-[0.8125rem] text-text-muted">No tenants assigned.</p>
        )}
        {unit.tenants?.map((tenant) => (
          <TenantRow key={tenant.id} tenant={tenant} onRefresh={onRefresh} />
        ))}
      </div>

      {showAddTenant ? (
        <div className="flex flex-col gap-2.5 pt-1">
          <div className="flex gap-1.5">
            <button
              type="button"
              className={mode === 'existing' ? tenantModeTabActive : tenantModeTabInactive}
              onClick={() => switchMode('existing')}
            >
              Choose existing
            </button>
            <button
              type="button"
              className={mode === 'new' ? tenantModeTabActive : tenantModeTabInactive}
              onClick={() => switchMode('new')}
            >
              New tenant
            </button>
          </div>

          {mode === 'existing' ? (
            <div className="flex flex-col gap-2">
              <input
                className={inputClass}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or phone"
                autoFocus
              />
              <div className="flex flex-col gap-1.5 max-h-[220px] overflow-y-auto">
                {directoryLoading && <p className="text-[0.8125rem] text-text-muted py-1.5 px-0.5">Loading tenants…</p>}
                {!directoryLoading && candidates.length === 0 && (
                  <p className="text-[0.8125rem] text-text-muted py-1.5 px-0.5">
                    {q ? 'No matching tenants.' : 'No other tenants available — add a new one instead.'}
                  </p>
                )}
                {!directoryLoading &&
                  candidates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      className="flex items-center justify-between gap-3 py-2 px-3 bg-bg-surface border border-border-subtle rounded-sm cursor-pointer text-left [transition:border-color_0.15s,background-color_0.15s] enabled:hover:border-border-strong enabled:hover:bg-bg-sunken disabled:opacity-60 disabled:cursor-not-allowed"
                      disabled={assigningId !== null}
                      onClick={() => handleAssignExisting(t)}
                    >
                      <span className="flex flex-col gap-[0.1rem] min-w-0">
                        {t.name && <span className={tenantNameClass}>{t.name}</span>}
                        <span className={tenantPhoneClass}>{t.phone}</span>
                      </span>
                      <span className="shrink-0 text-[0.6875rem] text-text-muted whitespace-nowrap">
                        {assigningId === t.id
                          ? 'Assigning…'
                          : t.units
                            ? `Currently: Unit ${t.units.unit_number}${t.units.properties ? ` · ${t.units.properties.name}` : ''}`
                            : 'Unassigned'}
                      </span>
                    </button>
                  ))}
              </div>
              <div className="flex gap-2 justify-end">
                <button type="button" className={cancelBtnClass} onClick={() => setShowAddTenant(false)}>
                  Cancel
                </button>
              </div>
              {error && <p className={errorClass}>{error}</p>}
            </div>
          ) : (
            <form onSubmit={handleAddTenant} className="flex flex-col gap-2">
              <input
                className={inputClass}
                value={tenantName}
                onChange={(e) => setTenantName(e.target.value)}
                placeholder="Name (optional)"
              />
              <input
                className={inputClass}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone number"
                required
              />
              <div className="flex gap-2 justify-end">
                <button type="button" className={cancelBtnClass} onClick={() => setShowAddTenant(false)}>
                  Cancel
                </button>
                <button type="submit" className={saveBtnClass} disabled={loading}>
                  {loading ? 'Adding…' : 'Add Tenant'}
                </button>
              </div>
              {error && <p className={errorClass}>{error}</p>}
            </form>
          )}
        </div>
      ) : (
        <button className={addTenantBtnClass} onClick={openAddTenant}>
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
    <div className="flex items-center justify-between py-2 px-3 bg-bg-surface rounded-sm border border-border-subtle">
      <div className="flex flex-col gap-[0.1rem]">
        {tenant.name && <span className={tenantNameClass}>{tenant.name}</span>}
        <span className={tenantPhoneClass}>{tenant.phone}</span>
      </div>
      <button className={removeBtnClass} onClick={handleRemove}>
        Remove
      </button>
    </div>
  )
}
