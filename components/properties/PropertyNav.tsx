'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { PropertySummary } from '@/types'
import styles from './PropertyNav.module.css'

type Props = {
  properties: PropertySummary[]
}

export default function PropertyNav({ properties }: Props) {
  const pathname = usePathname()

  return (
    <nav className={styles.nav}>
      <Link href="/dashboard/properties" className={styles.newBtn}>
        + New Property
      </Link>
      {properties.length === 0 && (
        <p className={styles.empty}>No properties yet.</p>
      )}
      {properties.map((p) => {
        const isActive = pathname === `/dashboard/properties/${p.id}`
        return (
          <Link
            key={p.id}
            href={`/dashboard/properties/${p.id}`}
            className={`${styles.item} ${isActive ? styles.itemActive : ''}`}
          >
            {p.name}
          </Link>
        )
      })}
    </nav>
  )
}
