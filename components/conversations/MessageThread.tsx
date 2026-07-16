'use client'

import { useEffect, useLayoutEffect, useRef, useState, useCallback, useMemo } from 'react'
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

// Cross-file contract for the keyset-paginated "load older messages" endpoint.
// Colocated here (not types/index.ts) since it's feature-specific, not a DB row.
export type MessagesPageResponse = {
  messages: ThreadMessage[]
  hasMore: boolean
}

type Props = {
  conversationId: string
  initialMessages: ThreadMessage[]
  initialHasMore: boolean
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

export default function MessageThread({ conversationId, initialMessages, initialHasMore, tenantName, tenantInitials, searchQuery }: Props) {
  const [messages, setMessages] = useState<ThreadMessage[]>(initialMessages)
  const bottomRef = useRef<HTMLDivElement>(null)

  // ── Older-message pagination (scroll-up to load more) ──
  const [hasMore, setHasMore] = useState(initialHasMore)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  // One-shot scroll anchor: set right before a prepend, consumed by the layout
  // effect below, then cleared. Null at all other times so a Realtime append
  // (which also mutates `messages`) leaves the scroll position untouched.
  const pendingScrollAdjustRef = useRef<{ prevScrollTop: number; prevScrollHeight: number } | null>(null)

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

  // Fetch the next older page (keyset by the oldest currently-loaded message).
  const loadOlder = useCallback(async () => {
    if (loadingOlder || !hasMore || messages.length === 0) return

    const list = listRef.current
    if (list) {
      pendingScrollAdjustRef.current = {
        prevScrollTop: list.scrollTop,
        prevScrollHeight: list.scrollHeight,
      }
    }
    setLoadingOlder(true)
    setLoadError(null)

    const cursor = messages[0].created_at
    try {
      const res = await fetch(
        `/api/conversations/${conversationId}/messages?cursor=${encodeURIComponent(cursor)}`,
      )
      if (!res.ok) throw new Error('Failed to load earlier messages')
      const data = (await res.json()) as MessagesPageResponse
      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id))
        const fresh = data.messages.filter((m) => !existingIds.has(m.id))
        return [...fresh, ...prev]
      })
      setHasMore(data.hasMore)
    } catch {
      // No prepend happened — drop the pending anchor so a later Realtime
      // append doesn't apply a stale scroll correction. Leave `hasMore` as-is
      // so scrolling up again retries.
      pendingScrollAdjustRef.current = null
      setLoadError('Failed to load earlier messages')
    } finally {
      setLoadingOlder(false)
    }
  }, [conversationId, hasMore, loadingOlder, messages])

  // Keep a stable ref to the latest loadOlder so the observer effect can be
  // scoped to conversationId only (like the Realtime effect) without
  // re-subscribing on every message change.
  const loadOlderRef = useRef(loadOlder)
  useEffect(() => {
    loadOlderRef.current = loadOlder
  })

  // Watch a sentinel above the list; load older messages as it approaches view.
  useEffect(() => {
    const sentinel = sentinelRef.current
    const root = listRef.current
    if (!sentinel || !root) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadOlderRef.current()
      },
      { root, rootMargin: '200px 0px 0px 0px' },
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [conversationId])

  // Preserve scroll position after prepending older messages: anchor the
  // viewport to the same content by offsetting scrollTop by the height gained.
  // useLayoutEffect so the correction lands before paint (no visible jump).
  useLayoutEffect(() => {
    const adjust = pendingScrollAdjustRef.current
    if (!adjust) return
    const list = listRef.current
    if (list) {
      const newScrollHeight = list.scrollHeight
      list.scrollTop = adjust.prevScrollTop + (newScrollHeight - adjust.prevScrollHeight)
    }
    pendingScrollAdjustRef.current = null
  }, [messages])

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
    <div className={styles.list} ref={listRef}>
      {/* Sentinel for scroll-up pagination — must stay the first child of .list */}
      <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true" />

      {loadingOlder && (
        <p className={styles.loadingOlder}>Loading earlier messages…</p>
      )}
      {loadError && (
        <p className={styles.loadOlderError} role="alert">{loadError}</p>
      )}

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
