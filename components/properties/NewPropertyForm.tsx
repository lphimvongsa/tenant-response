'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import styles from './NewPropertyForm.module.css'

type Props = {
  clientId: string
  inline?: boolean
}

export default function NewPropertyForm({ clientId, inline }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ client_id: clientId, name, address }),
    })

    setLoading(false)

    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Something went wrong')
      return
    }

    const property = await res.json()
    setName('')
    setAddress('')
    setOpen(false)
    router.refresh()
    router.push(`/dashboard/properties/${property.id}`)
  }

  if (inline && !open) {
    return (
      <button className={styles.triggerBtn} onClick={() => setOpen(true)}>
        + New Property
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className={`${styles.form} ${inline ? styles.formInline : styles.formCentered}`}>
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
      <div className={styles.actions}>
        {inline && (
          <button type="button" className={styles.cancelBtn} onClick={() => setOpen(false)}>
            Cancel
          </button>
        )}
        <button type="submit" className={styles.submitBtn} disabled={loading}>
          {loading ? 'Creating…' : 'Create Property'}
        </button>
      </div>
      {error && <p className={styles.error}>{error}</p>}
    </form>
  )
}
