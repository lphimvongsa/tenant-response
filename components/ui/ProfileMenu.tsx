'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { signOut } from '@/app/login/actions'
import { computeInitials } from '@/lib/utils/initials'
import styles from './ProfileMenu.module.css'

// Support/contact address — reused from the join-code error copy in
// app/login/actions.ts rather than inventing a new one.
const SUPPORT_EMAIL = 'lukas.verdancysolutions@gmail.com'

const SettingsIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
)

const HelpIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
    <path d="M12 17h.01" />
  </svg>
)

const SignOutIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5" />
    <path d="M21 12H9" />
  </svg>
)

interface ProfileMenuProps {
  name: string
  email: string
}

export default function ProfileMenu({ name, email }: ProfileMenuProps) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const initials = computeInitials(name, email)
  const trimmedName = name.trim()
  const displayName = trimmedName || email || 'Your account'
  // Hide the email line when it would duplicate the name line (i.e. name is
  // empty, so displayName already shows the email).
  const showEmail = Boolean(trimmedName) && Boolean(email)

  // Close and return keyboard focus to the trigger — used for Escape and for
  // activating a menu item.
  function closeAndRefocus() {
    setOpen(false)
    triggerRef.current?.focus()
  }

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node
      if (panelRef.current?.contains(target) || triggerRef.current?.contains(target)) {
        return
      }
      // Outside click: close without stealing focus back to the trigger, so
      // whatever the user clicked keeps it.
      setOpen(false)
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeAndRefocus()
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  return (
    <div className={styles.root}>
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Profile menu"
        onClick={() => setOpen((value) => !value)}
      >
        {initials}
      </button>

      {open && (
        <div ref={panelRef} className={styles.panel} role="menu">
          <div className={styles.header}>
            <div className={styles.headerAvatar} aria-hidden="true">
              {initials}
            </div>
            <div className={styles.headerText}>
              <p className={styles.headerName}>{displayName}</p>
              {showEmail && <p className={styles.headerEmail}>{email}</p>}
            </div>
          </div>

          <div className={styles.divider} role="separator" />

          <Link
            href="/dashboard/settings"
            className={styles.item}
            role="menuitem"
            onClick={closeAndRefocus}
          >
            {SettingsIcon}
            <span>Account settings</span>
          </Link>

          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className={styles.item}
            role="menuitem"
            onClick={closeAndRefocus}
          >
            {HelpIcon}
            <span>Help</span>
          </a>

          <div className={styles.divider} role="separator" />

          <form action={signOut} className={styles.signOutForm}>
            <button type="submit" className={`${styles.item} ${styles.signOut}`} role="menuitem">
              {SignOutIcon}
              <span>Sign out</span>
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
