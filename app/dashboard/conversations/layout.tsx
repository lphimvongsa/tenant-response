import { supabase } from '@/lib/integrations/supabase'
import ConversationList from '@/components/conversations/ConversationList'
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
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', height: '100%' }}>
      {/* Conversation list panel */}
      <div
        style={{
          width: '320px',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          borderRight: '1px solid rgba(52,71,103,0.08)',
          background: '#ffffff',
        }}
      >
        {error ? (
          <div style={{ padding: '1rem' }}>
            <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#b91c1c' }}>Failed to load</p>
            <p style={{ fontSize: '0.75rem', color: '#7f1d1d', marginTop: '0.25rem' }}>{error.message}</p>
          </div>
        ) : (
          <ConversationList conversations={conversations} basePath="/dashboard/conversations" />
        )}
      </div>

      {/* Detail panel */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  )
}
