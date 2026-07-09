import { redirect } from 'next/navigation'
import { supabase } from '@/lib/integrations/supabase'
import { getCurrentManager } from '@/lib/integrations/supabase-auth'
import NewPropertyForm from '@/components/properties/NewPropertyForm'
import PropertyPhotoPlaceholder from '@/components/properties/PropertyPhotoPlaceholder'
import Link from 'next/link'
import styles from './properties.module.css'

type ListUnit = {
  id: string
  tenants: { id: string }[] | null
  tickets: { id: string; status: string }[] | null
}

type ListProperty = {
  id: string
  name: string
  address: string
  photo_url: string | null
  units: ListUnit[] | null
}

const OUTSTANDING_STATUSES = ['open', 'in_progress', 'in_review']

function countOpenTickets(units: ListUnit[]): number {
  return units.reduce(
    (sum, u) =>
      sum +
      (Array.isArray(u.tickets)
        ? u.tickets.filter((t) => OUTSTANDING_STATUSES.includes(t.status)).length
        : 0),
    0,
  )
}

export default async function PropertiesPage() {
  const manager = await getCurrentManager()
  if (!manager) {
    // proxy.ts already gates /dashboard/**; this is a defensive fallback.
    redirect('/')
  }

  const clientId = manager.clientId

  const { data: properties, error } = await supabase
    .from('properties')
    .select('id, name, address, photo_url, units(id, tenants(id), tickets(id, status))')
    .eq('client_id', clientId)
    .order('name', { ascending: true })

  if (error) {
    return (
      <div className={styles.empty}>
        <h2 className={styles.emptyTitle}>Couldn&rsquo;t load properties</h2>
        <p className={styles.emptyDesc}>{error.message}</p>
      </div>
    )
  }

  const list = (properties ?? []) as ListProperty[]

  if (list.length === 0) {
    return (
      <div className={styles.empty}>
        <h2 className={styles.emptyTitle}>No properties yet</h2>
        <p className={styles.emptyDesc}>
          Create your first property to start assigning units and tenants.
        </p>
        <NewPropertyForm clientId={clientId} />
      </div>
    )
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Properties</h1>
        <NewPropertyForm clientId={clientId} />
      </header>

      <div className={styles.grid}>
        {list.map((p) => {
          const units = Array.isArray(p.units) ? p.units : []
          const unitCount = units.length
          const tenantCount = units.reduce(
            (sum, u) => sum + (Array.isArray(u.tenants) ? u.tenants.length : 0),
            0,
          )
          const openCount = countOpenTickets(units)

          return (
            <Link
              key={p.id}
              href={`/dashboard/properties/${p.id}`}
              className={styles.card}
            >
              <div className={styles.photoWrap}>
                {p.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.photo_url} alt={p.name} className={styles.photo} />
                ) : (
                  <PropertyPhotoPlaceholder className={styles.photo} />
                )}
                <span className={openCount > 0 ? styles.badgeAttention : styles.badgeClear}>
                  {openCount > 0
                    ? `Needs attention · ${openCount}`
                    : 'All clear'}
                </span>
              </div>

              <div className={styles.cardBody}>
                <p className={styles.cardName}>{p.name}</p>
                <p className={styles.cardAddress}>{p.address}</p>
                <p className={styles.cardMeta}>
                  {unitCount} unit{unitCount !== 1 ? 's' : ''} · {tenantCount} tenant
                  {tenantCount !== 1 ? 's' : ''}
                </p>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
