import { supabase } from '@/lib/integrations/supabase'
import NewPropertyForm from '@/components/properties/NewPropertyForm'
import Link from 'next/link'
import styles from './properties.module.css'

export default async function PropertiesPage() {
  const [{ data: properties }, { data: client }] = await Promise.all([
    supabase
      .from('properties')
      .select('id, name, address, units(id, tenants(id))')
      .order('name', { ascending: true }),
    supabase.from('clients').select('id').limit(1).single(),
  ])

  const clientId = client?.id ?? ''

  if (!properties || properties.length === 0) {
    return (
      <div className={styles.empty}>
        <h2 className={styles.emptyTitle}>No properties yet</h2>
        <p className={styles.emptyDesc}>Create your first property to start assigning units and tenants.</p>
        <NewPropertyForm clientId={clientId} />
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Properties</h1>
        <NewPropertyForm clientId={clientId} inline />
      </header>
      <div className={styles.grid}>
        {properties.map((p) => {
          const unitCount = Array.isArray(p.units) ? p.units.length : 0
          const tenantCount = Array.isArray(p.units)
            ? p.units.reduce((sum: number, u: { tenants: { id: string }[] | null }) => sum + (Array.isArray(u.tenants) ? u.tenants.length : 0), 0)
            : 0
          return (
            <Link key={p.id} href={`/dashboard/properties/${p.id}`} className={styles.card}>
              <p className={styles.cardName}>{p.name}</p>
              <p className={styles.cardAddress}>{p.address}</p>
              <p className={styles.cardMeta}>{unitCount} unit{unitCount !== 1 ? 's' : ''} · {tenantCount} tenant{tenantCount !== 1 ? 's' : ''}</p>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
