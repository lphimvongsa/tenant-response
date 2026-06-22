import { supabase } from '@/lib/integrations/supabase'
import SidebarTabs from '@/components/sidebar/SidebarTabs'
import type { Conversation, PropertySummary } from '@/types'
import styles from './dashboard.module.css'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [{ data: conversations }, { data: properties }] = await Promise.all([
    supabase
      .from('conversations')
      .select(`id, status, created_at, last_message_at, tenants(id, phone, name), messages(body, direction, created_at)`)
      .order('last_message_at', { ascending: false, nullsFirst: false }),
    supabase
      .from('properties')
      .select('id, name')
      .order('name', { ascending: true }),
  ])

  const typedConversations: Conversation[] = (conversations ?? []) as unknown as Conversation[]
  const typedProperties: PropertySummary[] = (properties ?? []) as PropertySummary[]

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <SidebarTabs
          conversations={typedConversations}
          properties={typedProperties}
        />
      </aside>
      <main className={styles.main}>
        {children}
      </main>
    </div>
  )
}
