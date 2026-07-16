'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { timeAgo } from '@/lib/utils/time'
import type { Conversation } from '@/types'
import MassTextModal from './MassTextModal'
import styles from './ConversationList.module.css'

const SearchIcon = (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
)

const SendIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
)

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

// Deterministic avatar hue from a string
const AVATAR_PALETTES = [
  { bg: 'var(--color-ink)', text: 'var(--color-on-ink)' },
  { bg: 'var(--color-success)', text: 'var(--color-on-ink)' },
  { bg: 'var(--color-warning)', text: 'var(--color-on-ink)' },
  { bg: 'var(--color-danger)', text: 'var(--color-on-ink)' },
  { bg: 'var(--color-text-secondary)', text: 'var(--color-on-ink)' },
]
function avatarPalette(str: string) {
  const hash = str.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return AVATAR_PALETTES[hash % AVATAR_PALETTES.length]
}

export default function ConversationList({ conversations, basePath = '/dashboard/conversations' }: Props) {
  const [query, setQuery] = useState('')
  const [massTextOpen, setMassTextOpen] = useState(false)
  const pathname = usePathname()

  const filtered = query.trim()
    ? conversations.filter((conv) => {
        const name = (conv.tenants?.name ?? conv.tenants?.phone ?? '').toLowerCase()
        return name.includes(query.toLowerCase())
      })
    : conversations

  return (
    <>
      <div className={styles.container}>
      {/* Header */}
      <div className={styles.header}>
        <h1 className={styles.title}>Conversations</h1>
        <span className={styles.countBadge}>{conversations.length}</span>
        <button
          type="button"
          className={styles.massTextBtn}
          onClick={() => setMassTextOpen(true)}
        >
          {SendIcon}
          Mass text
        </button>
      </div>

      {/* Search */}
      <div className={styles.searchWrap}>
        <span className={styles.searchIcon}>{SearchIcon}</span>
        <input
          type="search"
          placeholder="Search…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={styles.searchInput}
          aria-label="Search conversations"
        />
      </div>

      {/* List */}
      <nav className={styles.list} aria-label="Conversation list">
        {filtered.length === 0 && (
          <p className={styles.empty}>No conversations found.</p>
        )}
        {filtered.map((conv) => {
          const href = `${basePath}/${conv.id}`
          const active = pathname === href
          const tenant = conv.tenants
          const displayName = tenant?.name ?? tenant?.phone ?? 'Unknown'
          const last = getLastMessage(conv.messages)
          const preview = last
            ? (last.direction === 'outbound' ? 'You: ' : '') + truncate(last.body, 42)
            : 'No messages yet'
          const timeLabel = last ? timeAgo(last.created_at) : timeAgo(conv.created_at)
          const unreadCount = conv.messages.filter(
            (m) => m.direction === 'inbound' && !m.is_read
          ).length
          const initials = displayName
            .split(' ')
            .filter(Boolean)
            .slice(0, 2)
            .map((w: string) => w[0].toUpperCase())
            .join('') || '?'
          const palette = avatarPalette(displayName)

          return (
            <Link
              key={conv.id}
              href={href}
              className={`${styles.item} ${active ? styles.itemActive : ''}`}
              aria-current={active ? 'page' : undefined}
            >
              {/* Avatar */}
              <div
                className={styles.avatar}
                style={{ background: active ? 'var(--color-ink)' : palette.bg, color: palette.text }}
                aria-hidden="true"
              >
                {initials}
              </div>

              {/* Text */}
              <div className={styles.content}>
                <div className={styles.row1}>
                  <span className={`${styles.name} ${active ? styles.nameActive : ''}`}>
                    {displayName}
                  </span>
                  <span className={styles.time}>{timeLabel}</span>
                </div>
                <div className={styles.row2}>
                  <span className={`${styles.preview} ${active ? styles.previewActive : ''}`}>
                    {conv.status === 'escalated' && (
                      <span className={styles.escalatedDot} aria-label="Escalated">⚠ </span>
                    )}
                    {preview}
                  </span>
                  {unreadCount > 0 && (
                    <span className={styles.badge} aria-label={`${unreadCount} unread`}>
                      {unreadCount}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          )
        })}
      </nav>
      </div>

      {massTextOpen && <MassTextModal onClose={() => setMassTextOpen(false)} />}
    </>
  )
}
