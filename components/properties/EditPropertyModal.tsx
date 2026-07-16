'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Property } from '@/types'
import PropertyPhotoPlaceholder from './PropertyPhotoPlaceholder'
import {
  inputBase,
  inputClass,
  saveBtnClass,
  cancelBtnClass,
  deleteBtnClass,
  removeBtnClass,
  errorClass,
  photoFrameClass,
  photoClass,
} from './propertyStyles'

// Outlined pill for the photo upload/change trigger (formerly .photoBtn).
const photoBtnClass =
  'py-[0.45rem] px-3.5 text-[0.8125rem] font-semibold text-ink border-[1.5px] border-border-strong rounded-pill cursor-pointer [transition:background-color_0.15s,border-color_0.15s] enabled:hover:bg-bg-sunken enabled:hover:border-ink disabled:opacity-50 disabled:cursor-not-allowed'

// Single "Edit Property" modal covering photo upload/remove, the
// name/address/location fields, and property deletion.
export default function EditPropertyModal({
  property,
  onClose,
  onRefresh,
}: {
  property: Property
  onClose: () => void
  onRefresh: () => void
}) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [name, setName] = useState(property.name)
  const [address, setAddress] = useState(property.address)
  const [city, setCity] = useState(property.city ?? '')
  const [state, setState] = useState(property.state ?? '')
  const [country, setCountry] = useState(property.country ?? '')
  const [zip, setZip] = useState(property.zip ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoError, setPhotoError] = useState('')

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch(`/api/properties/${property.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, address, city, state, country, zip }),
    })
    setLoading(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error ?? 'Failed to save')
      return
    }
    onRefresh()
    onClose()
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
    <div
      className="fixed inset-0 z-50 flex justify-center bg-overlay items-end p-0 md:items-center md:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full overflow-y-auto bg-bg-surface shadow-modal max-w-none max-h-[92vh] rounded-t-lg md:max-w-[480px] md:max-h-[90vh] md:rounded-lg">
        <div className="flex items-center justify-between py-5 px-6 border-b border-border-subtle">
          <h2 className="text-base font-bold text-text-primary">Edit Property</h2>
          <button
            className="flex items-center justify-center w-8 h-8 shrink-0 text-text-secondary rounded-sm cursor-pointer [transition:color_0.15s,background-color_0.15s] hover:text-text-primary hover:bg-bg-sunken"
            onClick={onClose}
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-3 p-6">
          <div className="flex items-center gap-4">
            <div className={photoFrameClass}>
              {property.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={property.photo_url} alt={property.name} className={photoClass} />
              ) : (
                <PropertyPhotoPlaceholder className={photoClass} />
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handlePhotoSelect}
              className="hidden"
            />
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                className={photoBtnClass}
                onClick={() => fileInputRef.current?.click()}
                disabled={photoBusy}
              >
                {photoBusy ? 'Working…' : property.photo_url ? 'Change Photo' : 'Upload Photo'}
              </button>
              {property.photo_url && (
                <button
                  type="button"
                  className={removeBtnClass}
                  onClick={handleRemovePhoto}
                  disabled={photoBusy}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
          {photoError && <p className={errorClass}>{photoError}</p>}

          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Property name"
            required
            autoFocus
          />
          <input
            className={inputClass}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Address"
            required
          />
          <div className="flex gap-2">
            <input
              className={`${inputBase} flex-[2]`}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City"
              required
            />
            <input
              className={inputClass}
              value={state}
              onChange={(e) => setState(e.target.value)}
              placeholder="State"
              required
            />
            <input
              className={inputClass}
              value={zip}
              onChange={(e) => setZip(e.target.value)}
              placeholder="ZIP"
              required
            />
          </div>
          <input
            className={inputClass}
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            placeholder="Country"
            required
          />

          <div className="flex items-center justify-between gap-2 mt-1">
            <button type="button" className={deleteBtnClass} onClick={handleDelete}>
              Delete Property
            </button>
            <div className="flex gap-2">
              <button type="button" className={cancelBtnClass} onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className={saveBtnClass} disabled={loading}>
                {loading ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
          {error && <p className={errorClass}>{error}</p>}
        </form>
      </div>
    </div>
  )
}
