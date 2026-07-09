'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import PropertyPhotoPlaceholder from './PropertyPhotoPlaceholder'
import styles from './NewPropertyForm.module.css'

type Props = {
  clientId: string
}

export default function NewPropertyForm({ clientId }: Props) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [country, setCountry] = useState('')
  const [zip, setZip] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function reset() {
    setName('')
    setAddress('')
    setCity('')
    setState('')
    setCountry('')
    setZip('')
    setPhotoFile(null)
    setPhotoPreview(null)
    setError('')
  }

  function close() {
    setOpen(false)
    reset()
  }

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, name, address, city, state, country, zip }),
    })

    if (!res.ok) {
      setLoading(false)
      const data = await res.json().catch(() => ({}))
      setError(data.error ?? 'Something went wrong')
      return
    }

    const property = await res.json()

    if (photoFile) {
      const formData = new FormData()
      formData.append('file', photoFile)
      const photoRes = await fetch(`/api/properties/${property.id}/photo`, {
        method: 'POST',
        body: formData,
      })
      if (!photoRes.ok) {
        // Property was created; surface the photo failure but don't block navigation.
        console.error('Failed to upload property photo')
      }
    }

    setLoading(false)
    close()
    router.refresh()
    router.push(`/dashboard/properties/${property.id}`)
  }

  return (
    <>
      <button className={styles.triggerBtn} onClick={() => setOpen(true)}>
        + New Property
      </button>

      {open && (
        <div
          className={styles.overlay}
          onClick={(e) => {
            if (e.target === e.currentTarget) close()
          }}
        >
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Add Property</h2>
              <button className={styles.closeBtn} onClick={close} aria-label="Close">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.photoRow}>
                <div className={styles.photoFrame}>
                  {photoPreview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={photoPreview} alt="" className={styles.photo} />
                  ) : (
                    <PropertyPhotoPlaceholder className={styles.photo} />
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  onChange={handlePhotoSelect}
                  className={styles.hiddenFileInput}
                />
                <button
                  type="button"
                  className={styles.photoBtn}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {photoFile ? 'Change Photo' : 'Upload Photo'}
                </button>
              </div>

              <input
                className={styles.input}
                placeholder="Property name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                autoFocus
              />
              <input
                className={styles.input}
                placeholder="Address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                required
              />
              <div className={styles.locationRow}>
                <input
                  className={`${styles.input} ${styles.cityInput}`}
                  placeholder="City"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  required
                />
                <input
                  className={`${styles.input} ${styles.stateInput}`}
                  placeholder="State"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  required
                />
                <input
                  className={`${styles.input} ${styles.zipInput}`}
                  placeholder="ZIP"
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                  required
                />
              </div>
              <input
                className={styles.input}
                placeholder="Country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                required
              />

              <div className={styles.actions}>
                <button type="button" className={styles.cancelBtn} onClick={close}>
                  Cancel
                </button>
                <button type="submit" className={styles.submitBtn} disabled={loading}>
                  {loading ? 'Creating…' : 'Create Property'}
                </button>
              </div>
              {error && <p className={styles.error}>{error}</p>}
            </form>
          </div>
        </div>
      )}
    </>
  )
}
