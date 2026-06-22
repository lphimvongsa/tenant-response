'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { timeAgo } from '@/lib/timeAgo'
import styles from './ConversationList.module.css'

type Message = {
  body: string
  direction: string
  created_at: string
}

type Tenant = {
  id: string
  phone: string
  name: string | null
}

export type Conversation = {
  id: string
  status: string
  created_at: string
  last_message_at: string | null
  tenants: Tenant | null
  messages: Message[]
}

type Props = {
  conversations: Conversation[]
}

function getLastMessage(messages: Message[]): Message | null {
  if (!messages || messages.length === 0) return null
  return [...messages].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )[0]
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + '…' : text
}

export default function ConversationList({ conversations }: Props) {
  const pathname = usePathname()

  return (
    <nav className={styles.list}>
      {conversations.map((conv) => {
        const isActive = pathname === `/dashboard/${conv.id}`
        const tenant = conv.tenants
        const displayName = tenant?.name
          ? `${tenant.name} · ${tenant.phone}`
          : tenant?.phone ?? 'Unknown'
        const last = getLastMessage(conv.messages)
        const preview = last
          ? (last.direction === 'outbound' ? 'You: ' : '') + truncate(last.body, 60)
          : 'No messages yet'
        const timeLabel = last ? timeAgo(last.created_at) : timeAgo(conv.created_at)

        return (
          <Link
            key={conv.id}
            href={`/dashboard/${conv.id}`}
            className={`${styles.item} ${isActive ? styles.itemActive : ''}`}
          >
            <div className={styles.itemHeader}>
              <span className={styles.itemName}>{displayName}</span>
              <span className={styles.itemTime}>{timeLabel}</span>
            </div>
            <span className={styles.itemPreview}>{preview}</span>
          </Link>
        )
      })}
    </nav>
  )
}
