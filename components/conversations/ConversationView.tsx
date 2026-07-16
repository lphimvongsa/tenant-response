'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import RefreshButton from '@/components/ui/RefreshButton'
import MessageThread from './MessageThread'
import type { ThreadMessage } from './MessageThread'
import MessageInput from './MessageInput'
import EditContactPanel from './EditContactPanel'
import styles from './ConversationView.module.css'

type TenantInfo = {
  id: string
  name: string | null
  phone: string
  unit_id: string | null
}

type Unit = { id: string; unit_number: string }
type Property = { id: string; name: string; units: Unit[] }

type ConversationViewProps = {
  conversationId: string
  initialMessages: ThreadMessage[]
  initialHasMore: boolean
  tenant: TenantInfo | null
  isEscalated: boolean
  properties: Property[]
}

type TenantState = TenantInfo & { localPhotoUrl?: string | null }

const SearchIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
)

const PhoneIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.6 1.27h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.91a16 16 0 0 0 6.06 6.06l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
)

const MoreIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="5" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="12" cy="19" r="1" />
  </svg>
)

const XIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const ContactIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
  </svg>
)

const CheckIcon = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const ChevronIcon = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="6 9 12 15 18 9" />
  </svg>
)

const BackIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
  </svg>
)

const RefreshIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
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

export default function ConversationView({
  conversationId,
  initialMessages,
  initialHasMore,
  tenant,
  isEscalated,
  properties,
}: ConversationViewProps) {
  const router = useRouter()
  const [tenantState, setTenantState] = useState<TenantState | null>(tenant)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const [contactPanelOpen, setContactPanelOpen] = useState(false)
  const [escalated, setEscalated] = useState(isEscalated)
  const [statusMenuOpen, setStatusMenuOpen] = useState(false)
  const [statusPending, setStatusPending] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)

  const searchInputRef = useRef<HTMLInputElement>(null)
  const moreMenuWrapRef = useRef<HTMLDivElement>(null)
  const statusMenuWrapRef = useRef<HTMLDivElement>(null)

  const tenantName = tenantState?.name ?? tenantState?.phone ?? 'Unknown'
  const tenantInitials = computeInitials(tenantName)

  // Auto-focus the search input when search opens
  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus()
  }, [searchOpen])

  // Close the more menu on outside click and Escape
  useEffect(() => {
    if (!moreMenuOpen) return

    function handleClick(e: MouseEvent) {
      if (moreMenuWrapRef.current && !moreMenuWrapRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false)
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMoreMenuOpen(false)
    }

    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [moreMenuOpen])

  // Close the status menu on outside click and Escape
  useEffect(() => {
    if (!statusMenuOpen) return

    function handleClick(e: MouseEvent) {
      if (statusMenuWrapRef.current && !statusMenuWrapRef.current.contains(e.target as Node)) {
        setStatusMenuOpen(false)
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setStatusMenuOpen(false)
    }

    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [statusMenuOpen])

  function toggleSearch() {
    setSearchOpen((prev) => {
      const next = !prev
      if (!next) setSearchQuery('')
      return next
    })
  }

  function handleSave(updated: TenantState) {
    setTenantState(updated)
    setContactPanelOpen(false)
  }

  function handlePhotoChange(url: string | null) {
    setTenantState((prev) => (prev ? { ...prev, localPhotoUrl: url } : prev))
  }

  async function handleSetStatus(target: 'escalated' | 'active') {
    setStatusMenuOpen(false)
    const targetEscalated = target === 'escalated'

    // No-op when already in the requested state (or a request is in flight)
    if (statusPending || targetEscalated === escalated) return

    setStatusPending(true)
    setStatusError(null)

    const endpoint = targetEscalated ? 'escalate' : 'resolve'

    try {
      const res = await fetch(`/api/conversations/${conversationId}/${endpoint}`, {
        method: 'POST',
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? `Request failed: ${res.status}`)
      }

      // Reflect the new state immediately, then reconcile with the server
      setEscalated(targetEscalated)
      setStatusPending(false)
      router.refresh()
    } catch (err) {
      setStatusError(
        err instanceof Error
          ? err.message
          : targetEscalated
            ? 'Failed to escalate this conversation'
            : 'Failed to switch this conversation back to AI Active',
      )
      setStatusPending(false)
    }
  }

  const showHeaderPhoto = contactPanelOpen && Boolean(tenantState?.localPhotoUrl)

  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <Link
            href="/dashboard/conversations"
            className={styles.backBtn}
            aria-label="Back to conversations"
          >
            {BackIcon}
          </Link>
          <div className={styles.headerAvatar} aria-hidden="true">
            {showHeaderPhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={tenantState!.localPhotoUrl!} alt="" className={styles.headerAvatarImg} />
            ) : (
              tenantInitials
            )}
          </div>
          <div className={styles.headerInfo}>
            <div className={styles.headerNameRow}>
              <h1 className={styles.headerName}>{tenantState?.name ?? 'Unknown'}</h1>
              <div className={styles.statusMenuWrap} ref={statusMenuWrapRef}>
                <button
                  className={`${styles.statusTrigger} ${
                    escalated ? styles.statusTriggerEscalated : styles.statusTriggerActive
                  }`}
                  type="button"
                  onClick={() => setStatusMenuOpen((prev) => !prev)}
                  disabled={statusPending}
                  aria-haspopup="menu"
                  aria-expanded={statusMenuOpen}
                  aria-label={`Bot status: ${escalated ? 'Escalated' : 'AI Active'}. Change status`}
                  title="Change the AI bot status for this conversation"
                >
                  <span className={styles.statusDot} aria-hidden="true" />
                  {statusPending ? 'Updating…' : escalated ? 'Escalated' : 'AI Active'}
                  <span className={styles.statusChevron}>{ChevronIcon}</span>
                </button>
                {statusMenuOpen && (
                  <div className={styles.statusMenu} role="menu">
                    <button
                      className={styles.statusMenuItem}
                      role="menuitemradio"
                      aria-checked={escalated}
                      type="button"
                      onClick={() => handleSetStatus('escalated')}
                    >
                      <span
                        className={`${styles.statusDot} ${styles.statusDotDanger}`}
                        aria-hidden="true"
                      />
                      <span className={styles.statusMenuItemBody}>
                        <span className={styles.statusMenuItemLabel}>Escalated</span>
                        <span className={styles.statusMenuItemHint}>AI bot paused</span>
                      </span>
                      {escalated && <span className={styles.statusCheck}>{CheckIcon}</span>}
                    </button>
                    <button
                      className={styles.statusMenuItem}
                      role="menuitemradio"
                      aria-checked={!escalated}
                      type="button"
                      onClick={() => handleSetStatus('active')}
                    >
                      <span
                        className={`${styles.statusDot} ${styles.statusDotActive}`}
                        aria-hidden="true"
                      />
                      <span className={styles.statusMenuItemBody}>
                        <span className={styles.statusMenuItemLabel}>AI Active</span>
                        <span className={styles.statusMenuItemHint}>Bot replies normally</span>
                      </span>
                      {!escalated && <span className={styles.statusCheck}>{CheckIcon}</span>}
                    </button>
                  </div>
                )}
              </div>
            </div>
            <p className={styles.headerSub}>
              {tenantState?.phone ?? ''}
              <span className={styles.headerDot}>·</span>
              via SMS
            </p>
            {statusError && (
              <p className={styles.resolveError} role="alert">{statusError}</p>
            )}
          </div>
        </div>

        <div className={styles.headerActions}>
          <button
            className={`${styles.headerBtn} ${searchOpen ? styles.headerBtnActive : ''}`}
            aria-label="Search messages"
            aria-pressed={searchOpen}
            onClick={toggleSearch}
            type="button"
          >
            {SearchIcon}
          </button>
          <button
            className={`${styles.headerBtn} ${styles.desktopOnlyAction}`}
            aria-label="Call tenant"
            type="button"
          >
            {PhoneIcon}
          </button>
          <span className={styles.desktopOnlyAction}>
            <RefreshButton />
          </span>
          <div className={styles.moreMenuWrap} ref={moreMenuWrapRef}>
            <button
              className={`${styles.headerBtn} ${moreMenuOpen ? styles.headerBtnActive : ''}`}
              aria-label="More options"
              aria-haspopup="menu"
              aria-expanded={moreMenuOpen}
              onClick={() => setMoreMenuOpen((prev) => !prev)}
              type="button"
            >
              {MoreIcon}
            </button>
            {moreMenuOpen && (
              <div className={styles.moreMenu} role="menu">
                {/* Call/Refresh are standalone header icons on desktop (see
                    .desktopOnlyAction above) — folded in here on mobile so
                    a narrow header doesn't have to fit 4+ icon buttons. */}
                <button
                  className={`${styles.moreMenuItem} ${styles.mobileOnlyMenuItem}`}
                  role="menuitem"
                  type="button"
                  aria-label="Call tenant"
                  onClick={() => setMoreMenuOpen(false)}
                >
                  {PhoneIcon}
                  Call tenant
                </button>
                <button
                  className={`${styles.moreMenuItem} ${styles.mobileOnlyMenuItem}`}
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setMoreMenuOpen(false)
                    router.refresh()
                  }}
                >
                  {RefreshIcon}
                  Refresh
                </button>
                <button
                  className={styles.moreMenuItem}
                  role="menuitem"
                  type="button"
                  onClick={() => {
                    setMoreMenuOpen(false)
                    setContactPanelOpen(true)
                  }}
                >
                  {ContactIcon}
                  Edit contact
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Search bar ── */}
      {searchOpen && (
        <div className={styles.searchBar}>
          {SearchIcon}
          <input
            ref={searchInputRef}
            className={styles.searchInput}
            type="text"
            placeholder="Search messages…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className={styles.searchClear}
              aria-label="Clear search"
              type="button"
              onClick={() => setSearchQuery('')}
            >
              {XIcon}
            </button>
          )}
          <button className={styles.searchClose} type="button" onClick={toggleSearch}>
            Close
          </button>
        </div>
      )}

      {/* ── Thread ── */}
      <MessageThread
        conversationId={conversationId}
        initialMessages={initialMessages}
        initialHasMore={initialHasMore}
        tenantName={tenantName}
        tenantInitials={tenantInitials}
        searchQuery={searchOpen ? searchQuery : ''}
      />

      {/* ── Input ── */}
      <MessageInput conversationId={conversationId} />

      {/* ── Edit contact panel ── */}
      {contactPanelOpen && tenantState && (
        <EditContactPanel
          tenant={tenantState}
          properties={properties}
          onClose={() => setContactPanelOpen(false)}
          onSave={handleSave}
          onPhotoChange={handlePhotoChange}
        />
      )}
    </div>
  )
}
