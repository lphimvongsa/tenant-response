'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import styles from './IconSidebar.module.css'

type NavItem = {
  label: string
  href: string
  icon: React.ReactNode
  // Whether the route should match exactly or by prefix
  exact?: boolean
}

const HomeIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 9.5 12 3l9 6.5" />
    <path d="M5 9.5V21h14V9.5" />
    <path d="M9 21v-6h6v6" />
  </svg>
)

const ChatIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
)

const BuildingIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4" y="3" width="16" height="18" rx="1" />
    <path d="M9 7h2M9 11h2M9 15h2M13 7h2M13 11h2M13 15h2" />
    <path d="M9 21v-3h6v3" />
  </svg>
)

const WrenchIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14.7 6.3a4 4 0 0 0-5.3 5.3l-6 6a1.5 1.5 0 0 0 2.1 2.1l6-6a4 4 0 0 0 5.3-5.3l-2.4 2.4-2.1-2.1 2.4-2.4z" />
  </svg>
)

const NAV_ITEMS: NavItem[] = [
  { label: 'Overview', href: '/dashboard', icon: HomeIcon, exact: true },
  { label: 'Conversations', href: '/dashboard/conversations', icon: ChatIcon },
  { label: 'Properties', href: '/dashboard/properties', icon: BuildingIcon },
  { label: 'Maintenance', href: '/dashboard/maintenance', icon: WrenchIcon },
]

function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}

export default function IconSidebar() {
  const pathname = usePathname()

  return (
    <nav className={styles.sidebar} aria-label="Primary">
      <Link href="/dashboard" className={styles.brand} aria-label="TenaTimmy home">
        <img src="/tenatimmy_solo.png" alt="" width={32} height={32} />
      </Link>

      <ul className={styles.nav}>
        {NAV_ITEMS.map((item) => {
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
    </nav>
  )
}
