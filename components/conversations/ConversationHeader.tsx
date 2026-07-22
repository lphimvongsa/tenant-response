'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import RefreshButton from '@/components/ui/RefreshButton'

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

// Header icon button — display class is applied per-instance so the
// desktop-only Call button can override it (hidden on mobile) without a
// conflicting display utility.
const HEADER_BTN =
  'items-center justify-center w-9 h-9 rounded-[10px] border-none bg-transparent [color:var(--color-on-glass-muted)] cursor-pointer transition-colors duration-150 hover:[background:rgba(255,255,255,0.1)] hover:[color:var(--color-on-glass)] focus-visible:[outline:2px_solid_var(--color-on-glass)] focus-visible:outline-offset-2'

// Kebab menu row — display class applied per-instance (mobile-only rows use
// flex md:hidden).
const MORE_MENU_ITEM =
  'items-center gap-2.5 w-full py-2.5 px-3.5 border-none bg-transparent rounded-[8px] text-sm [color:var(--color-on-glass)] cursor-pointer text-left transition-colors duration-150 hover:[background:rgba(255,255,255,0.1)]'

type ConversationHeaderProps = {
  conversationId: string
  displayName: string
  phone: string
  initials: string
  photoUrl: string | null
  isEscalated: boolean
  searchOpen: boolean
  onToggleSearch: () => void
  onEditContact: () => void
}

export default function ConversationHeader({
  conversationId,
  displayName,
  phone,
  initials,
  photoUrl,
  isEscalated,
  searchOpen,
  onToggleSearch,
  onEditContact,
}: ConversationHeaderProps) {
  const router = useRouter()
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const [escalated, setEscalated] = useState(isEscalated)
  const [statusMenuOpen, setStatusMenuOpen] = useState(false)
  const [statusPending, setStatusPending] = useState(false)
  const [statusError, setStatusError] = useState<string | null>(null)

  const moreMenuWrapRef = useRef<HTMLDivElement>(null)
  const statusMenuWrapRef = useRef<HTMLDivElement>(null)

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

  return (
    <header className="flex items-center justify-between px-4 h-16 shrink-0 [background:var(--glass-bg)] backdrop-blur-[var(--glass-blur)] border-b [border-color:var(--glass-border)] gap-2 md:px-6 md:h-[72px] md:gap-4">
      <div className="flex items-center gap-2.5 min-w-0 md:gap-3.5">
        <Link
          href="/dashboard/conversations"
          className="flex items-center justify-center w-8 h-8 shrink-0 rounded-[10px] [color:var(--color-on-glass-muted)] transition-colors duration-150 hover:[background:rgba(255,255,255,0.1)] hover:[color:var(--color-on-glass)] focus-visible:[outline:2px_solid_var(--color-on-glass)] focus-visible:outline-offset-2 md:hidden"
          aria-label="Back to conversations"
        >
          {BackIcon}
        </Link>
        <div
          className="shrink-0 w-9 h-9 rounded-[13px] [background:var(--glass-bg-strong)] border [border-color:var(--glass-border)] [color:var(--color-on-glass)] text-xs font-bold flex items-center justify-center tracking-[0.02em] overflow-hidden md:w-[42px] md:h-[42px] md:text-sm"
          aria-hidden="true"
        >
          {photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            initials
          )}
        </div>
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-base font-bold [color:var(--color-on-glass)] m-0 whitespace-nowrap overflow-hidden text-ellipsis">
              {displayName}
            </h1>
            <div className="relative shrink-0" ref={statusMenuWrapRef}>
              <button
                className={`inline-flex items-center gap-1.5 text-[0.625rem] font-bold [font-family:inherit] border [border-color:var(--glass-border)] [background:var(--glass-bg-strong)] rounded-full py-[0.15rem] px-2 leading-[1.6] cursor-pointer transition duration-150 hover:enabled:border-current active:enabled:opacity-80 focus-visible:[outline:2px_solid_currentColor] focus-visible:outline-offset-2 disabled:cursor-default disabled:opacity-70 ${
                  escalated ? '[color:#ffb4b4]' : '[color:#7ee0b8]'
                }`}
                type="button"
                onClick={() => setStatusMenuOpen((prev) => !prev)}
                disabled={statusPending}
                aria-haspopup="menu"
                aria-expanded={statusMenuOpen}
                aria-label={`Bot status: ${escalated ? 'Escalated' : 'AI Active'}. Change status`}
                title="Change the AI bot status for this conversation"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" aria-hidden="true" />
                {statusPending ? 'Updating…' : escalated ? 'Escalated' : 'AI Active'}
                <span className="inline-flex items-center -ml-[0.0625rem] opacity-75">{ChevronIcon}</span>
              </button>
              {statusMenuOpen && (
                <div
                  className="absolute left-0 top-[calc(100%+6px)] [background:var(--glass-bg-strong)] backdrop-blur-[var(--glass-blur)] border [border-color:var(--glass-border)] rounded-[12px] shadow-[var(--glass-shadow)] p-1.5 min-w-[220px] z-[200]"
                  role="menu"
                >
                  <button
                    className="flex items-center gap-2.5 w-full py-2 px-3 border-none bg-transparent rounded-[8px] [color:var(--color-on-glass)] cursor-pointer text-left transition-colors duration-150 hover:[background:rgba(255,255,255,0.1)] focus-visible:[outline:2px_solid_var(--color-on-glass)] focus-visible:-outline-offset-2"
                    role="menuitemradio"
                    aria-checked={escalated}
                    type="button"
                    onClick={() => handleSetStatus('escalated')}
                  >
                    <span className="w-1.5 h-1.5 rounded-full [background:#ffb4b4] shrink-0" aria-hidden="true" />
                    <span className="flex flex-col gap-[0.0625rem] flex-1 min-w-0">
                      <span className="text-[0.8125rem] font-semibold">Escalated</span>
                      <span className="text-[0.6875rem] [color:var(--color-on-glass-subtle)]">AI bot paused</span>
                    </span>
                    {escalated && (
                      <span className="inline-flex items-center [color:var(--color-on-glass)] shrink-0">{CheckIcon}</span>
                    )}
                  </button>
                  <button
                    className="flex items-center gap-2.5 w-full py-2 px-3 border-none bg-transparent rounded-[8px] [color:var(--color-on-glass)] cursor-pointer text-left transition-colors duration-150 hover:[background:rgba(255,255,255,0.1)] focus-visible:[outline:2px_solid_var(--color-on-glass)] focus-visible:-outline-offset-2"
                    role="menuitemradio"
                    aria-checked={!escalated}
                    type="button"
                    onClick={() => handleSetStatus('active')}
                  >
                    <span className="w-1.5 h-1.5 rounded-full [background:#7ee0b8] shrink-0" aria-hidden="true" />
                    <span className="flex flex-col gap-[0.0625rem] flex-1 min-w-0">
                      <span className="text-[0.8125rem] font-semibold">AI Active</span>
                      <span className="text-[0.6875rem] [color:var(--color-on-glass-subtle)]">Bot replies normally</span>
                    </span>
                    {!escalated && (
                      <span className="inline-flex items-center [color:var(--color-on-glass)] shrink-0">{CheckIcon}</span>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>
          <p className="text-xs [color:var(--color-on-glass-muted)] m-0 flex items-center gap-1.5">
            {phone}
            <span className="opacity-50">·</span>
            via SMS
          </p>
          {statusError && (
            <p className="text-[0.6875rem] [color:#ffb4b4] mt-0.5 mx-0 mb-0" role="alert">
              {statusError}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          className={`flex ${HEADER_BTN}${searchOpen ? ' [background:var(--glass-bg-strong)]! [color:var(--color-on-glass)]!' : ''}`}
          aria-label="Search messages"
          aria-pressed={searchOpen}
          onClick={onToggleSearch}
          type="button"
        >
          {SearchIcon}
        </button>
        <button className={`hidden md:flex ${HEADER_BTN}`} aria-label="Call tenant" type="button">
          {PhoneIcon}
        </button>
        <span className="hidden md:flex md:items-center">
          <RefreshButton />
        </span>
        <div className="relative" ref={moreMenuWrapRef}>
          <button
            className={`flex ${HEADER_BTN}${moreMenuOpen ? ' [background:var(--glass-bg-strong)]! [color:var(--color-on-glass)]!' : ''}`}
            aria-label="More options"
            aria-haspopup="menu"
            aria-expanded={moreMenuOpen}
            onClick={() => setMoreMenuOpen((prev) => !prev)}
            type="button"
          >
            {MoreIcon}
          </button>
          {moreMenuOpen && (
            <div
              className="absolute right-0 top-[calc(100%+6px)] [background:var(--glass-bg-strong)] backdrop-blur-[var(--glass-blur)] border [border-color:var(--glass-border)] rounded-[12px] shadow-[var(--glass-shadow)] p-1.5 min-w-[180px] z-[200]"
              role="menu"
            >
              {/* Call/Refresh are standalone header icons on desktop (see the
                  hidden md:flex buttons above) — folded in here on mobile so
                  a narrow header doesn't have to fit 4+ icon buttons. */}
              <button
                className={`flex md:hidden ${MORE_MENU_ITEM}`}
                role="menuitem"
                type="button"
                aria-label="Call tenant"
                onClick={() => setMoreMenuOpen(false)}
              >
                {PhoneIcon}
                Call tenant
              </button>
              <button
                className={`flex md:hidden ${MORE_MENU_ITEM}`}
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
                className={`flex ${MORE_MENU_ITEM}`}
                role="menuitem"
                type="button"
                onClick={() => {
                  setMoreMenuOpen(false)
                  onEditContact()
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
  )
}
