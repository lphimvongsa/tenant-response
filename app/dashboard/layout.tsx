import { supabase } from '@/lib/supabase-server'
import ConversationList, { type Conversation } from '@/components/ConversationList'
import styles from './dashboard.module.css'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { data: conversations } = await supabase
    .from('conversations')
    .select(`id, status, created_at, last_message_at, tenants(id, phone, name), messages(body, direction, created_at)`)
    .order('last_message_at', { ascending: false, nullsFirst: false })

  const typedConversations: Conversation[] = (conversations ?? []) as unknown as Conversation[]

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <p className={styles.sidebarHeading}>Conversations</p>
        <ConversationList conversations={typedConversations} />
      </aside>
      <main className={styles.main}>
        {children}
      </main>
    </div>
  )
}
