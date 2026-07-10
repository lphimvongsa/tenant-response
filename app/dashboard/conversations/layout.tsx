import { supabase } from '@/lib/integrations/supabase'
import ConversationList from '@/components/conversations/ConversationList'
import ConversationsSplitView from '@/components/conversations/ConversationsSplitView'
import type { Conversation } from '@/types'

export default async function ConversationsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { data, error } = await supabase
    .from('conversations')
    .select('id, status, created_at, last_message_at, tenants(id, phone, name), messages(body, direction, created_at, is_read)')
    .order('last_message_at', { ascending: false, nullsFirst: false })

  const conversations = (data ?? []) as unknown as Conversation[]

  return (
    <ConversationsSplitView
      list={
        error ? (
          <div style={{ padding: '1rem' }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-danger)' }}>Failed to load</p>
            <p style={{ fontSize: '0.75rem', color: 'var(--color-danger)', marginTop: '0.25rem' }}>{error.message}</p>
          </div>
        ) : (
          <ConversationList conversations={conversations} basePath="/dashboard/conversations" />
        )
      }
      detail={children}
    />
  )
}
