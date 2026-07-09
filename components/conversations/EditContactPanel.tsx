'use client'

import { useEffect, useRef, useState } from 'react'
import { supabaseBrowser } from '@/lib/integrations/supabase-browser'
import styles from './EditContactPanel.module.css'

type TenantInfo = {
  id: string
  name: string | null
  phone: string
  unit_id: string | null
}

type TenantState = TenantInfo & { localPhotoUrl?: string | null }

type Unit = { id: string; unit_number: string }
type Property = { id: string; name: string; units: Unit[] }

type EditContactPanelProps = {
  tenant: TenantState
  properties: Property[]
  onClose: () => void
  onSave: (updated: TenantState) => void
  onPhotoChange?: (url: string | null) => void
}

const XIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

function computeInitials(name: string): string {
  return (
    name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join('') || '?'
  )
}

export default function EditContactPanel({
  tenant,
  properties,
  onClose,
  onSave,
  onPhotoChange,
}: EditContactPanelProps) {
  const [name, setName] = useState(tenant.name ?? '')
  const [unitId, setUnitId] = useState(tenant.unit_id ?? '')
  const [localPhotoPreview, setLocalPhotoPreview] = useState<string | null>(null)
  const [storagePhotoUrl, setStoragePhotoUrl] = useState<string | null>(null)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const displayName = name.trim() || tenant.phone
  const initials = computeInitials(displayName)

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setPhotoError(null)

    // Immediate local preview via FileReader
    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : null
      setLocalPhotoPreview(result)
      if (result) onPhotoChange?.(result)
    }
    reader.readAsDataURL(file)

    // Upload to Supabase Storage
    setUploading(true)
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg'
      const path = `${tenant.id}/avatar.${ext}`
      const { error: uploadError } = await supabaseBrowser.storage
        .from('tenant-photos')
        .upload(path, file, { upsert: true })
      if (uploadError) throw uploadError
      const { data } = supabaseBrowser.storage.from('tenant-photos').getPublicUrl(path)
      setStoragePhotoUrl(data.publicUrl)
    } catch {
      setPhotoError('Photo upload failed — preview shown but the photo won’t be saved.')
    } finally {
      setUploading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setError(null)

    const body: Record<string, string | null> = {}
    body.name = name.trim() || null
    body.unit_id = unitId || null
    if (storagePhotoUrl) body.photo_url = storagePhotoUrl

    try {
      const res = await fetch(`/api/tenants/${tenant.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error ?? 'Failed to save contact')
      }
      const updated = (await res.json()) as Partial<TenantInfo>
      onSave({
        ...tenant,
        ...updated,
        name: name.trim() || null,
        unit_id: unitId || null,
        localPhotoUrl: storagePhotoUrl ?? tenant.localPhotoUrl ?? null,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save contact')
      setSaving(false)
    }
  }

  return (
    <>
      <div className={styles.overlay} onClick={onClose} aria-hidden="true" />
      <aside className={styles.panel} role="dialog" aria-label="Edit contact">
        <div className={styles.panelHeader}>
          <h2 className={styles.panelTitle}>Edit contact</h2>
          <button className={styles.closeBtn} type="button" aria-label="Close" onClick={onClose}>
            {XIcon}
          </button>
        </div>

        <div className={styles.content}>
          {/* Avatar */}
          <div className={styles.avatarSection}>
            <div className={styles.avatar} aria-hidden="true">
              {localPhotoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={localPhotoPreview} alt="" className={styles.avatarImg} />
              ) : (
                initials
              )}
            </div>
            <button
              className={styles.changePhotoBtn}
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? 'Uploading…' : 'Change photo'}
            </button>
            <input
              ref={fileInputRef}
              className={styles.fileInput}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
            />
            {photoError && <p className={styles.photoError}>{photoError}</p>}
          </div>

          {/* Fields */}
          <div className={styles.fields}>
            <div className={styles.field}>
              <label className={styles.label} htmlFor="contact-name">Name</label>
              <input
                id="contact-name"
                className={styles.input}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contact name"
              />
            </div>

            <div className={styles.field}>
              <span className={styles.label}>Phone</span>
              <div className={styles.lockedField}>{tenant.phone}</div>
            </div>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="contact-unit">Property &amp; Unit</label>
              <select
                id="contact-unit"
                className={styles.select}
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
              >
                <option value="">No property assigned</option>
                {properties.map((prop) => (
                  <optgroup key={prop.id} label={prop.name}>
                    {prop.units.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {prop.name} — {unit.unit_number}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button
            className={styles.saveBtn}
            type="button"
            onClick={handleSave}
            disabled={saving || uploading}
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </aside>
    </>
  )
}
