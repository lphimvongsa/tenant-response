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

// There is no separate header bar on any breakpoint — the profile link
// into account settings lives here instead, as the tab bar's 5th item
// (the desktop icon sidebar has its own copy, pinned to the bottom of
// the rail).
//
// Stays mounted on every dashboard route, including individual conversation
// threads — MessageInput reserves space above it (see its mobile
// padding-bottom) so the fixed bar never covers the composer.
//
// Icon-only, floating pill style: labels are visually hidden (still in the
// DOM for screen readers) and the active item's icon lifts into a raised
// circular bubble that overlaps the top of the bar.
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
              <span className={styles.iconWrap}>
                <ProfileMenu name={name} email={email} />
              </span>
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
            <span className={styles.iconWrap}>{item.icon}</span>
            <span className={styles.label}>{item.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
