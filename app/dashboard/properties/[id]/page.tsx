import { supabase } from '@/lib/integrations/supabase'
import { notFound } from 'next/navigation'
import PropertyEditor from '@/components/properties/PropertyEditor'
import type { Property } from '@/types'

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const { data } = await supabase
    .from('properties')
    .select('id, name, address, created_at, units(id, unit_number, tenants(id, name, phone))')
    .eq('id', id)
    .single()

  if (!data) notFound()

  const property = data as unknown as Property

  return <PropertyEditor property={property} />
}
