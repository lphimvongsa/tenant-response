import { supabase } from '@/lib/integrations/supabase'
import ConversationView from '@/components/conversations/ConversationView'
import type { ThreadMessage } from '@/components/conversations/MessageThread'

type TenantRow = { id: string; name: string | null; phone: string; unit_id: string | null }
type UnitRow = { id: string; unit_number: string }
type PropertyRow = { id: string; name: string; units: UnitRow[] }
type ConvRow = { id: string; status: string | null; tenants: TenantRow | null }

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>
}) {
  const { conversationId } = await params

  const [{ data: messages }, { data: conversation }, { data: propertiesData }] = await Promise.all([
    supabase
      .from('messages')
      .select('id, direction, body, created_at, is_read')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true }),
    supabase
      .from('conversations')
      .select('id, status, tenants(id, phone, name, unit_id)')
      .eq('id', conversationId)
      .single(),
    supabase
      .from('properties')
      .select('id, name, units(id, unit_number)')
      .order('name', { ascending: true }),
  ])

  const initialMessages = (messages ?? []) as unknown as ThreadMessage[]
  const conv = conversation as ConvRow | null
  const tenant = conv?.tenants ?? null
  const isEscalated = conv?.status === 'escalated'
  const properties = (propertiesData ?? []) as unknown as PropertyRow[]

  return (
    <ConversationView
      conversationId={conversationId}
      initialMessages={initialMessages}
      tenant={tenant}
      isEscalated={isEscalated}
      properties={properties}
    />
  )
}
