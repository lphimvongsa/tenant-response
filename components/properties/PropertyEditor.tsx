'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Property, PropertyUnit, PropertyTenant } from '@/types'
import styles from './PropertyEditor.module.css'

type Props = {
  property: Property
}

export default function PropertyEditor({ property }: Props) {
  const router = useRouter()

  function refresh() {
    router.refresh()
  }

  return (
    <div className={styles.page}>
      <PropertyHeader property={property} onRefresh={refresh} />
      <UnitList propertyId={property.id} units={property.units ?? []} onRefresh={refresh} />
    </div>
  )
}

// ─── Property header (name + address, inline edit, delete) ───────────────────

function PropertyHeader({ property, onRefresh }: { property: Property; onRefresh: () => void }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(property.name)
  const [address, setAddress] = useState(property.address)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
      const d = await res.json()
      setError(d.error ?? 'Failed to save')
      return
    }
    setEditing(false)
    onRefresh()
  }

  async function handleDelete() {
    if (!confirm(`Delete "${property.name}" and all its units and tenants?`)) return
    await fetch(`/api/properties/${property.id}`, { method: 'DELETE' })
    router.push('/dashboard/properties')
    router.refresh()
  }

  return (
    <header className={styles.header}>
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
            <button type="button" className={styles.cancelBtn} onClick={() => setEditing(false)}>Cancel</button>
            <button type="submit" className={styles.saveBtn} disabled={loading}>{loading ? 'Saving…' : 'Save'}</button>
          </div>
          {error && <p className={styles.error}>{error}</p>}
        </form>
      ) : (
        <>
          <div className={styles.headerInfo}>
            <h1 className={styles.propName}>{property.name}</h1>
            <p className={styles.propAddress}>{property.address}</p>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.editBtn} onClick={() => setEditing(true)}>Edit</button>
            <button className={styles.deleteBtn} onClick={handleDelete}>Delete</button>
          </div>
        </>
      )}
    </header>
  )
}

// ─── Unit list ───────────────────────────────────────────────────────────────

function UnitList({ propertyId, units, onRefresh }: { propertyId: string; units: PropertyUnit[]; onRefresh: () => void }) {
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
      const d = await res.json()
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
          <button className={styles.addBtn} onClick={() => setShowAddUnit(true)}>+ Add Unit</button>
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
          <button type="button" className={styles.cancelBtn} onClick={() => setShowAddUnit(false)}>Cancel</button>
          <button type="submit" className={styles.saveBtn} disabled={loading}>{loading ? 'Adding…' : 'Add Unit'}</button>
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
  const [phone, setPhone] = useState('')
  const [tenantName, setTenantName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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
      const d = await res.json()
      setError(d.error ?? 'Failed to add tenant')
      return
    }
    setPhone('')
    setTenantName('')
    setShowAddTenant(false)
    onRefresh()
  }

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
        <span className={styles.unitNumber}>Unit {unit.unit_number}</span>
        <button className={styles.deleteBtn} onClick={handleDeleteUnit}>Delete unit</button>
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
        <form onSubmit={handleAddTenant} className={styles.addTenantForm}>
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
            autoFocus
          />
          <div className={styles.addTenantActions}>
            <button type="button" className={styles.cancelBtn} onClick={() => setShowAddTenant(false)}>Cancel</button>
            <button type="submit" className={styles.saveBtn} disabled={loading}>{loading ? 'Adding…' : 'Add Tenant'}</button>
          </div>
          {error && <p className={styles.error}>{error}</p>}
        </form>
      ) : (
        <button className={styles.addTenantBtn} onClick={() => setShowAddTenant(true)}>
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
      <button className={styles.removeBtn} onClick={handleRemove}>Remove</button>
    </div>
  )
}
