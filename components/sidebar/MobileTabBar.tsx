'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_ITEMS, isActive } from './navItems'
import ProfileMenu from '@/components/ui/ProfileMenu'
import styles from './MobileTabBar.module.css'

type Props = {
  name: string
  email: string
}

// There is no separate header bar on any breakpoint — the profile menu
// (account settings / help / sign out) lives here instead, as the tab
// bar's 5th item (the desktop icon sidebar has its own copy, pinned to
// the bottom of the rail).
//
// Stays mounted on every dashboard route, including individual conversation
// threads — MessageInput reserves space above it (see its mobile
// padding-bottom) so the fixed bar never covers the composer.
export default function MobileTabBar({ name, email }: Props) {
  const pathname = usePathname()

  return (
    <nav className={styles.bar} aria-label="Primary">
      {NAV_ITEMS.map((item) => {
        const active = isActive(pathname, item)
        const className = `${styles.item} ${active ? styles.itemActive : ''}`

        if (item.profile) {
          return (
            <div key={item.href} className={className}>
              <ProfileMenu name={name} email={email} placement="above-right" />
              <span className={styles.label}>{item.label}</span>
            </div>
          )
        }

        return (
          <Link
            key={item.href}
            href={item.href}
            className={className}
            aria-current={active ? 'page' : undefined}
          >
            {item.icon}
            <span className={styles.label}>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
