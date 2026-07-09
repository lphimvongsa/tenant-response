'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_ITEMS, isActive } from './navItems'
import ProfileMenu from '@/components/ui/ProfileMenu'
import styles from './IconSidebar.module.css'

type Props = {
  name: string
  email: string
}

// There is no separate top header bar — the profile menu (account settings /
// help / sign out) lives here instead, pinned to the bottom of the sidebar.
export default function IconSidebar({ name, email }: Props) {
  const pathname = usePathname()

  return (
    <nav className={styles.sidebar} aria-label="Primary">
      <Link href="/dashboard" className={styles.brand} aria-label="TenaTimmy home">
        <img src="/tenatimmy_solo.png" alt="" width={32} height={32} />
      </Link>

      <ul className={styles.nav}>
        {NAV_ITEMS.filter((item) => !item.profile).map((item) => {
          const active = isActive(pathname, item)
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`${styles.item} ${active ? styles.itemActive : ''}`}
                aria-current={active ? 'page' : undefined}
                title={item.label}
              >
                <span className={styles.icon}>{item.icon}</span>
              </Link>
            </li>
          )
        })}
      </ul>

      {/* Pinned to the bottom via .profileSlot's margin-top: auto — opens
          upward since it sits near the bottom of the viewport. */}
      <div className={styles.profileSlot}>
        <ProfileMenu name={name} email={email} placement="above-left" />
      </div>
    </nav>
  )
}
