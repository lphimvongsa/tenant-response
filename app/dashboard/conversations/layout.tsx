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
    <div className="flex flex-1 overflow-hidden">
      {/* Persistent conversation list panel */}
      <div className="flex w-[340px] flex-shrink-0 flex-col overflow-hidden border-r border-[rgba(52,71,103,0.12)] bg-white">
        <header className="flex-shrink-0 border-b border-[rgba(52,71,103,0.06)] px-4 py-3.5">
          <h1 className="text-base font-semibold text-[#344767]">Conversations</h1>
          {!error && (
            <p className="mt-0.5 text-xs text-[#7b809a]">
              {conversations.length} thread{conversations.length !== 1 ? 's' : ''}
            </p>
          )}
        </header>
        {error ? (
          <div className="px-4 py-5">
            <p className="text-xs font-semibold text-[#b91c1c]">Failed to load</p>
            <p className="mt-1 text-xs text-[#7f1d1d]">{error.message}</p>
          </div>
        ) : conversations.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-[#b0b7c3]">No conversations yet.</p>
        ) : (
          <ConversationList conversations={conversations} basePath="/dashboard/conversations" />
        )}
      </div>

      {/* Detail panel — changes when a conversation is selected */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  )
}
