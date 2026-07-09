import { supabase } from '@/lib/integrations/supabase'
import { notFound } from 'next/navigation'
import PropertyProfile from '@/components/properties/PropertyProfile'
import type { Property } from '@/types'

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const { data } = await supabase
    .from('properties')
    .select(
      'id, name, address, photo_url, created_at, units(id, unit_number, tenants(id, name, phone), tickets(id, title, category, location, severity, description, status, photo_url, assigned_to, created_at, tenants(id, name, phone)))',
    )
    .eq('id', id)
    .single()

  if (!data) notFound()

  const property = data as unknown as Property

  return <PropertyProfile property={property} />
}
