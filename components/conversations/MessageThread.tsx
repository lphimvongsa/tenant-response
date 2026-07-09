'use client'

import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import type { ReactNode } from 'react'
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
  tenantName: string
  tenantInitials: string
  searchQuery?: string
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function highlightBody(text: string, query: string): ReactNode {
  if (!query.trim()) return text
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const parts = text.split(new RegExp(`(${escaped})`, 'gi'))
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase()
      ? <mark key={i} className={styles.highlight}>{part}</mark>
      : <span key={i}>{part}</span>
  )
}

const CheckIcon = (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

export default function MessageThread({ conversationId, initialMessages, tenantName, tenantInitials, searchQuery }: Props) {
  const [messages, setMessages] = useState<ThreadMessage[]>(initialMessages)
  const bottomRef = useRef<HTMLDivElement>(null)

  const filtered = useMemo(() => {
    const q = searchQuery?.trim().toLowerCase() ?? ''
    if (!q) return messages
    return messages.filter((m) => m.body.toLowerCase().includes(q))
  }, [messages, searchQuery])

  useEffect(() => {
    bottomRef.current?.scrollIntoView()
  }, [])

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // Mark unread messages as read on open
  useEffect(() => {
    const hasUnread = initialMessages.some((m) => m.direction === 'inbound' && !m.is_read)
    if (!hasUnread) return
    fetch(`/api/conversations/${conversationId}/read`, { method: 'PATCH' })
    setMessages((prev) =>
      prev.map((m) => (m.direction === 'inbound' ? { ...m, is_read: true } : m))
    )
  }, [conversationId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime subscription
  useEffect(() => {
    const channel = supabaseBrowser
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const incoming = payload.new as ThreadMessage
          const msg: ThreadMessage =
            incoming.direction === 'inbound' ? { ...incoming, is_read: true } : incoming
          setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev
            return [...prev, msg]
          })
          scrollToBottom()
          if (incoming.direction === 'inbound') {
            fetch(`/api/conversations/${conversationId}/read`, { method: 'PATCH' })
          }
        }
      )
      .subscribe()
    return () => { supabaseBrowser.removeChannel(channel) }
  }, [conversationId, scrollToBottom])

  const toggleRead = useCallback(async (messageId: string, currentIsRead: boolean) => {
    const next = !currentIsRead
    setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, is_read: next } : m)))
    try {
      const res = await fetch(`/api/messages/${messageId}/read`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_read: next }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, is_read: currentIsRead } : m)))
    }
  }, [])

  return (
    <div className={styles.list}>
      {messages.length === 0 && (
        <p className={styles.empty}>No messages yet.</p>
      )}

      {filtered.length === 0 && messages.length > 0 && (
        <p className={styles.empty}>No messages match your search.</p>
      )}

      {filtered.map((msg, i) => {
        const isInbound = msg.direction === 'inbound'
        // Show sender label when this is the first message in a run from this direction
        const prevDir = i > 0 ? filtered[i - 1].direction : null
        const showLabel = prevDir !== msg.direction

        return (
          <div key={msg.id} className={`${styles.group} ${isInbound ? styles.groupInbound : styles.groupOutbound}`}>
            {/* Sender avatar */}
            {isInbound ? (
              <div className={styles.avatar} aria-hidden="true">{tenantInitials}</div>
            ) : (
              <div className={`${styles.avatar} ${styles.avatarOutbound}`} aria-hidden="true">LP</div>
            )}

            <div className={styles.msgCol}>
              {/* Sender label */}
              {showLabel && (
                <p className={`${styles.senderLabel} ${isInbound ? styles.senderLabelInbound : styles.senderLabelOutbound}`}>
                  {isInbound ? tenantName : 'You'}
                </p>
              )}

              {/* Bubble */}
              <div className={`${styles.bubble} ${isInbound ? styles.bubbleInbound : styles.bubbleOutbound}`}>
                <p className={styles.body}>{highlightBody(msg.body, searchQuery ?? '')}</p>
              </div>

              {/* Meta row */}
              <div className={`${styles.meta} ${isInbound ? '' : styles.metaOutbound}`}>
                <span className={styles.time}>{formatTime(msg.created_at)}</span>
                {!isInbound && (
                  <span
                    className={`${styles.readCheck} ${msg.is_read ? styles.readCheckRead : ''}`}
                    title={msg.is_read ? 'Read' : 'Delivered'}
                  >
                    {CheckIcon}
                  </span>
                )}
                {isInbound && (
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
        )
      })}

      <div ref={bottomRef} />
    </div>
  )
}
