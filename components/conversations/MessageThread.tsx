'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { supabaseBrowser } from '@/lib/integrations/supabase-browser'
import styles from './MessageThread.module.css'

export type ThreadMessage = {
  id: string
  direction: 'inbound' | 'outbound'
  body: string
  created_at: string
  is_read: boolean
}

type Props = {
  conversationId: string
  initialMessages: ThreadMessage[]
}

export default function MessageThread({ conversationId, initialMessages }: Props) {
  const [messages, setMessages] = useState<ThreadMessage[]>(initialMessages)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom on initial load (instant, no animation)
  useEffect(() => {
    bottomRef.current?.scrollIntoView()
  }, [])

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // Mark all unread inbound messages as read when conversation opens
  useEffect(() => {
    const hasUnread = initialMessages.some(m => m.direction === 'inbound' && !m.is_read)
    if (!hasUnread) return

    fetch(`/api/conversations/${conversationId}/read`, { method: 'PATCH' })
    setMessages(prev =>
      prev.map(m => (m.direction === 'inbound' ? { ...m, is_read: true } : m))
    )
  }, [conversationId]) // intentionally omit initialMessages — run once per conversation

  // Realtime subscription for new messages on this conversation
  useEffect(() => {
    const channel = supabaseBrowser
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const incoming = payload.new as ThreadMessage
          // Auto-mark inbound messages as read (conversation is open)
          const msg: ThreadMessage =
            incoming.direction === 'inbound' ? { ...incoming, is_read: true } : incoming
          setMessages(prev => {
            // Deduplicate: skip if we already have this id
            if (prev.some(m => m.id === msg.id)) return prev
            return [...prev, msg]
          })
          scrollToBottom()
          if (incoming.direction === 'inbound') {
            fetch(`/api/conversations/${conversationId}/read`, { method: 'PATCH' })
          }
        },
      )
      .subscribe()

    return () => {
      supabaseBrowser.removeChannel(channel)
    }
  }, [conversationId, scrollToBottom])

  const toggleRead = useCallback(async (messageId: string, currentIsRead: boolean) => {
    const next = !currentIsRead
    // Optimistic update
    setMessages(prev => prev.map(m => (m.id === messageId ? { ...m, is_read: next } : m)))
    try {
      const res = await fetch(`/api/messages/${messageId}/read`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_read: next }),
      })
      if (!res.ok) throw new Error()
    } catch {
      // Revert on failure
      setMessages(prev => prev.map(m => (m.id === messageId ? { ...m, is_read: currentIsRead } : m)))
    }
  }, [])

  return (
    <div className={styles.list}>
      {messages.length === 0 && (
        <p className={styles.empty}>No messages yet.</p>
      )}
      {messages.map((msg) => (
        <div key={msg.id} className={`${styles.row} ${styles[msg.direction]}`}>
          {/* Unread dot for inbound — positioned to the left */}
          {msg.direction === 'inbound' && (
            <span
              className={`${styles.unreadDot} ${msg.is_read ? styles.unreadDotHidden : ''}`}
              aria-hidden="true"
            />
          )}

          <div className={`${styles.bubble} ${styles[msg.direction]}`}>
            <p className={styles.body}>{msg.body}</p>
            <div className={styles.meta}>
              <span className={styles.time}>
                {new Date(msg.created_at).toLocaleTimeString('en-US', {
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </span>
              {msg.direction === 'inbound' && (
                <button
                  className={styles.readToggle}
                  onClick={() => toggleRead(msg.id, msg.is_read)}
                  title={msg.is_read ? 'Mark as unread' : 'Mark as read'}
                >
                  {msg.is_read ? 'Mark unread' : 'Mark read'}
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
