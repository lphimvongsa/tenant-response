'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { timeAgo } from '@/lib/utils/time'
import type { Conversation } from '@/types'
import styles from './ConversationList.module.css'

type Props = {
  conversations: Conversation[]
  basePath?: string
}

function getLastMessage(messages: Conversation['messages']): Conversation['messages'][number] | null {
  if (!messages || messages.length === 0) return null
  return [...messages].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0]
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '…' : text
}

export default function ConversationList({ conversations, basePath = '/dashboard/conversations' }: Props) {
  const pathname = usePathname()

  return (
    <nav className={styles.list}>
      {conversations.map((conv) => {
        const href = `${basePath}/${conv.id}`
        const isActive = pathname === href
        const tenant = conv.tenants
        const displayName = tenant?.name
          ? `${tenant.name} · ${tenant.phone}`
          : tenant?.phone ?? 'Unknown'
        const last = getLastMessage(conv.messages)
        const preview = last
          ? (last.direction === 'outbound' ? 'You: ' : '') + truncate(last.body, 60)
          : 'No messages yet'
        const timeLabel = last ? timeAgo(last.created_at) : timeAgo(conv.created_at)

        const unreadCount = conv.messages.filter(
          m => m.direction === 'inbound' && !m.is_read
        ).length

        return (
          <Link
            key={conv.id}
            href={href}
            className={`${styles.item} ${isActive ? styles.itemActive : ''}`}
          >
            <div className={styles.itemHeader}>
              <span className={styles.itemName}>{displayName}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flexShrink: 0 }}>
                {unreadCount > 0 && (
                  <span className={styles.unreadBadge}>{unreadCount}</span>
                )}
                <span className={styles.itemTime}>{timeLabel}</span>
              </div>
            </div>
            <span className={styles.itemPreview}>{preview}</span>
          </Link>
        )
      })}
    </nav>
  )
}
