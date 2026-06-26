import { supabase } from '@/lib/integrations/supabase'
import MessageInput from '@/components/conversations/MessageInput'
import RefreshButton from '@/components/ui/RefreshButton'
import MessageThread from '@/components/conversations/MessageThread'
import type { ThreadMessage } from '@/components/conversations/MessageThread'
import styles from '../../[conversationId]/conversation.module.css'

type Tenant = {
  phone: string
  name: string | null
}

type ConversationDetail = {
  id: string
  tenants: Tenant | null
}

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>
}) {
  const { conversationId } = await params

  const [{ data: messages }, { data: conversation }] = await Promise.all([
    supabase
      .from('messages')
      .select('id, direction, body, created_at, is_read')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true }),
    supabase
      .from('conversations')
      .select('id, tenants(phone, name)')
      .eq('id', conversationId)
      .single(),
  ])

  const initialMessages = (messages ?? []) as unknown as ThreadMessage[]
  const typedConversation = conversation as ConversationDetail | null

  const tenant = typedConversation?.tenants
  const displayName = tenant?.name
    ? `${tenant.name} · ${tenant.phone}`
    : tenant?.phone ?? 'Unknown'

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p className={styles.headerName}>{displayName}</p>
        <RefreshButton />
      </header>

      <MessageThread conversationId={conversationId} initialMessages={initialMessages} />

      <div className={styles.inputArea}>
        <MessageInput conversationId={conversationId} />
      </div>
    </div>
  )
}
