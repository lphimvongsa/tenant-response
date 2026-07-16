'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Property, TenantDirectoryEntry } from '@/types'
import MassTextRecipientPicker from './MassTextRecipientPicker'
import type { Recipient, RecipientGroup } from './MassTextRecipientPicker'
import styles from './MassTextModal.module.css'

// TODO: switch to `import type { MassTextResponse } from '@/types'` once the
// mass-text API route lands and exports it. Defined locally for now so this
// compiles independently — shape matches the agreed server contract exactly.
type MassTextResult = {
  tenantId: string
  tenantName: string | null
  phone: string
  status: 'sent' | 'failed'
  conversationId?: string
  messageId?: string
  error?: string
}

type MassTextResponse = {
  total: number
  sent: number
  failed: number
  results: MassTextResult[]
}

type MassTextModalProps = {
  onClose: () => void
}

type Step = 'select' | 'compose' | 'result'

const UNASSIGNED_KEY = '__unassigned__'

const XIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

// Approximate GSM-7 (160/segment) vs UCS-2 (70/segment) split. Any non-ASCII
// character forces UCS-2. Deliberately not a real GSM-7 billing calc — labeled
// "approx." in the UI. (charCode loop avoids a control-char regex lint flag.)
function isBasicAscii(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    if (text.charCodeAt(i) > 127) return false
  }
  return true
}

const STEP_TITLES: Record<Step, string> = {
  select: 'Select recipients',
  compose: 'Compose message',
  result: 'Result',
}

export default function MassTextModal({ onClose }: MassTextModalProps) {
  const router = useRouter()

  const [step, setStep] = useState<Step>('select')
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [groups, setGroups] = useState<RecipientGroup[]>([])

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [body, setBody] = useState('')

  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [result, setResult] = useState<MassTextResponse | null>(null)

  // Close on Escape (matches the EditContactPanel / TicketModal convention)
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  // Fetch recipients on mount and derive the grouped shape.
  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setLoadError(null)
      try {
        const [propRes, tenRes] = await Promise.all([
          fetch('/api/properties'),
          fetch('/api/tenants'),
        ])
        if (!propRes.ok || !tenRes.ok) {
          throw new Error('Failed to load recipients')
        }
        const properties = (await propRes.json()) as Property[]
        const tenants = (await tenRes.json()) as TenantDirectoryEntry[]
        if (cancelled) return

        // One group per property — rendered even if it has no tenants.
        const propertyGroups: RecipientGroup[] = properties.map((property) => ({
          key: property.id,
          label: property.name,
          tenants: (property.units ?? [])
            .flatMap((unit) => unit.tenants ?? [])
            .map((t) => ({ id: t.id, name: t.name, phone: t.phone })),
        }))

        // Tenants with no unit — the "Unassigned" bucket, only if non-empty.
        const unassigned: Recipient[] = tenants
          .filter((t) => t.unit_id === null)
          .map((t) => ({ id: t.id, name: t.name, phone: t.phone }))

        const nextGroups =
          unassigned.length > 0
            ? [...propertyGroups, { key: UNASSIGNED_KEY, label: 'Unassigned', tenants: unassigned }]
            : propertyGroups

        setGroups(nextGroups)
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : 'Failed to load recipients')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const toggleTenant = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleGroup = useCallback(
    (groupKey: string) => {
      setSelectedIds((prev) => {
        const group = groups.find((g) => g.key === groupKey)
        if (!group || group.tenants.length === 0) return prev
        const allSelected = group.tenants.every((t) => prev.has(t.id))
        const next = new Set(prev)
        if (allSelected) {
          group.tenants.forEach((t) => next.delete(t.id))
        } else {
          group.tenants.forEach((t) => next.add(t.id))
        }
        return next
      })
    },
    [groups],
  )

  const selectedCount = selectedIds.size
  const segments = body.length === 0 ? 0 : Math.ceil(body.length / (isBasicAscii(body) ? 160 : 70))

  async function handleSend() {
    if (body.trim() === '' || sending) return
    setSending(true)
    setSendError(null)
    try {
      const res = await fetch('/api/conversations/mass-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantIds: [...selectedIds], body }),
      })
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null
        throw new Error(data?.error ?? `Request failed: ${res.status}`)
      }
      const data = (await res.json()) as MassTextResponse
      setResult(data)
      setStep('result')
    } catch (err) {
      // Request-level failure (network / pre-loop 401/500): stay on compose so
      // the typed message isn't lost.
      setSendError(err instanceof Error ? err.message : 'Failed to send messages')
    } finally {
      setSending(false)
    }
  }

  function handleDone() {
    onClose()
    router.refresh()
  }

  const resultBannerClass = result
    ? result.failed === 0
      ? styles.resultBannerSuccess
      : result.sent === 0
        ? styles.resultBannerDanger
        : styles.resultBannerWarning
    : ''

  return (
    <div
      className={styles.overlay}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className={styles.panel} role="dialog" aria-modal="true" aria-label="Mass text">
        <div className={styles.header}>
          <h2 className={styles.title}>{STEP_TITLES[step]}</h2>
          <button className={styles.closeBtn} type="button" aria-label="Close" onClick={onClose}>
            {XIcon}
          </button>
        </div>

        <div className={styles.body}>
          {loadError ? (
            <p className={styles.errorBox}>{loadError}</p>
          ) : loading ? (
            <p className={styles.loading}>Loading recipients…</p>
          ) : step === 'select' ? (
            <MassTextRecipientPicker
              groups={groups}
              selectedIds={selectedIds}
              onToggleTenant={toggleTenant}
              onToggleGroup={toggleGroup}
            />
          ) : step === 'compose' ? (
            <>
              <p className={styles.composeInfo}>
                Sending to <strong>{selectedCount}</strong>{' '}
                {selectedCount === 1 ? 'recipient' : 'recipients'}
              </p>
              <textarea
                className={styles.textarea}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Type your message…"
                disabled={sending}
                autoFocus
              />
              <p className={styles.segmentInfo}>
                {body.length} characters · ~{segments} {segments === 1 ? 'segment' : 'segments'} (approx.)
              </p>
              {sending && (
                <p className={styles.sendingNote}>
                  Sending to {selectedCount} {selectedCount === 1 ? 'recipient' : 'recipients'} — this
                  may take a while for large lists.
                </p>
              )}
              {sendError && (
                <p className={styles.errorBox} role="alert" style={{ marginTop: '0.75rem' }}>
                  {sendError}
                </p>
              )}
            </>
          ) : result ? (
            <>
              <p className={`${styles.resultBanner} ${resultBannerClass}`}>
                {result.failed === 0
                  ? `All ${result.sent} ${result.sent === 1 ? 'message' : 'messages'} sent.`
                  : result.sent === 0
                    ? `All ${result.failed} ${result.failed === 1 ? 'message' : 'messages'} failed to send.`
                    : `${result.sent} sent, ${result.failed} failed.`}
              </p>
              <div className={styles.resultStats}>
                <div className={styles.stat}>
                  <span className={styles.statNum}>{result.total}</span>
                  <span className={styles.statLabel}>Total</span>
                </div>
                <div className={styles.stat}>
                  <span className={`${styles.statNum} ${styles.statNumSent}`}>{result.sent}</span>
                  <span className={styles.statLabel}>Sent</span>
                </div>
                <div className={styles.stat}>
                  <span className={`${styles.statNum} ${styles.statNumFailed}`}>{result.failed}</span>
                  <span className={styles.statLabel}>Failed</span>
                </div>
              </div>
              {result.failed > 0 && (
                <>
                  <p className={styles.failHeading}>Failed recipients</p>
                  <div className={styles.failList}>
                    {result.results
                      .filter((r) => r.status === 'failed')
                      .map((r) => (
                        <div key={r.tenantId} className={styles.failItem}>
                          <div className={styles.failRow}>
                            <span className={styles.failName}>{r.tenantName ?? r.phone}</span>
                            {r.tenantName && <span className={styles.failPhone}>{r.phone}</span>}
                          </div>
                          {r.error && <p className={styles.failError}>{r.error}</p>}
                        </div>
                      ))}
                  </div>
                </>
              )}
            </>
          ) : null}
        </div>

        {!loadError && !loading && (
          <div className={styles.footer}>
            {step === 'select' && (
              <>
                <span className={styles.footerInfo}>{selectedCount} selected</span>
                <button className={styles.btnSecondary} type="button" onClick={onClose}>
                  Cancel
                </button>
                <button
                  className={styles.btnPrimary}
                  type="button"
                  disabled={selectedCount === 0}
                  onClick={() => setStep('compose')}
                >
                  Next
                </button>
              </>
            )}
            {step === 'compose' && (
              <>
                <button
                  className={styles.btnSecondary}
                  type="button"
                  disabled={sending}
                  onClick={() => setStep('select')}
                >
                  Back
                </button>
                <button
                  className={styles.btnPrimary}
                  type="button"
                  disabled={body.trim() === '' || sending}
                  onClick={handleSend}
                >
                  {sending ? 'Sending…' : `Send to ${selectedCount}`}
                </button>
              </>
            )}
            {step === 'result' && (
              <button className={styles.btnPrimary} type="button" onClick={handleDone}>
                Done
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
