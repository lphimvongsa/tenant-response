import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { unstable_cache } from 'next/cache'
import { supabase } from '@/lib/integrations/supabase'
import { getCurrentManager } from '@/lib/integrations/supabase-auth'
import { CONVERSATIONS_TAG } from '@/lib/cache-tags'
import ConversationList from '@/components/conversations/ConversationList'
import ConversationsSplitView from '@/components/conversations/ConversationsSplitView'
import ConversationListSkeleton from '@/components/conversations/ConversationListSkeleton'
import type { Conversation } from '@/types'

const getCachedConversations = unstable_cache(
  async (clientId: string) => {
    const { data, error } = await supabase
      .from('conversations')
      .select('id, status, created_at, last_message_at, tenants(id, phone, name), messages(body, direction, created_at, is_read)')
      .eq('client_id', clientId)
      .order('last_message_at', { ascending: false, nullsFirst: false })
    return { data, error: error ? error.message : null }
  },
  ['conversations-list'],
  { revalidate: 15, tags: [CONVERSATIONS_TAG] },
)

// Fetching happens in this inner component (not the layout itself) and is
// wrapped in <Suspense> below — an async top-level await directly in a
// layout blocks the whole route's navigation on it, with no way for a
// loading.tsx to show a fallback. Isolating it lets the list pane stream in
// independently and lets thread-to-thread navigation reuse this pane instead
// of re-running this query on every click.
async function ConversationListPane({ clientId }: { clientId: string }) {
  const { data, error } = await getCachedConversations(clientId)

  if (error) {
    return (
      <div style={{ padding: '1rem' }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-danger)' }}>Failed to load</p>
        <p style={{ fontSize: '0.75rem', color: 'var(--color-danger)', marginTop: '0.25rem' }}>{error}</p>
      </div>
    )
  }

  const conversations = (data ?? []) as unknown as Conversation[]

  return <ConversationList conversations={conversations} basePath="/dashboard/conversations" />
}

export default async function ConversationsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const manager = await getCurrentManager()
  if (!manager) {
    // proxy.ts already gates /dashboard/**; this is a defensive fallback.
    redirect('/')
  }

  return (
    <ConversationsSplitView
      list={
        <Suspense fallback={<ConversationListSkeleton />}>
          <ConversationListPane clientId={manager.clientId} />
        </Suspense>
      }
      detail={children}
    />
  )
}
