import { supabase } from '@/lib/integrations/supabase'
import MessageInput from '@/components/conversations/MessageInput'
import RefreshButton from '@/components/ui/RefreshButton'
import styles from './conversation.module.css'

type Message = {
  id: string
  direction: string
  body: string
  created_at: string
}

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
      .select('id, direction, body, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true }),
    supabase
      .from('conversations')
      .select('id, tenants(phone, name)')
      .eq('id', conversationId)
      .single(),
  ])

  const typedMessages: Message[] = (messages ?? []) as Message[]
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

      <div className={styles.messageList}>
        {typedMessages.length === 0 && (
          <p className={styles.emptyState}>No messages yet.</p>
        )}
        {typedMessages.map((msg) => (
          <div
            key={msg.id}
            className={`${styles.messageRow} ${styles[msg.direction as 'inbound' | 'outbound']}`}
          >
            <div className={`${styles.bubble} ${styles[msg.direction as 'inbound' | 'outbound']}`}>
              <p>{msg.body}</p>
              <p className={styles.bubbleTime}>
                {new Date(msg.created_at).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.inputArea}>
        <MessageInput conversationId={conversationId} />
      </div>
    </div>
  )
}
