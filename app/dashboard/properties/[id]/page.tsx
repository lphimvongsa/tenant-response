import { redirect, notFound } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { supabase } from '@/lib/integrations/supabase'
import { getCurrentManager } from '@/lib/integrations/supabase-auth'
import { PROPERTIES_TAG } from '@/lib/cache-tags'
import PropertyProfile from '@/components/properties/PropertyProfile'
import type { Property } from '@/types'

const getCachedProperty = unstable_cache(
  async (id: string, clientId: string) => {
    const { data } = await supabase
      .from('properties')
      .select(
        'id, name, address, city, state, country, zip, photo_url, created_at, units(id, unit_number, tenants(id, name, phone), tickets(id, title, category, location, severity, description, status, photo_url, assigned_to, created_at, tenants(id, name, phone)))',
      )
      .eq('id', id)
      // Scoped to the caller's client — a property id guessed/enumerated from
      // another client must 404, not leak that client's units/tenants/tickets.
      .eq('client_id', clientId)
      .single()
    return data
  },
  ['property-detail'],
  { revalidate: 30, tags: [PROPERTIES_TAG] },
)

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const manager = await getCurrentManager()
  if (!manager) {
    // proxy.ts already gates /dashboard/**; this is a defensive fallback.
    redirect('/')
  }

  const data = await getCachedProperty(id, manager.clientId)

  if (!data) notFound()

  const property = data as unknown as Property

  return <PropertyProfile property={property} />
}
