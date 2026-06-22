'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import ConversationList from '@/components/conversations/ConversationList'
import PropertyNav from '@/components/properties/PropertyNav'
import type { Conversation, PropertySummary } from '@/types'
import styles from './SidebarTabs.module.css'

type Props = {
  conversations: Conversation[]
  properties: PropertySummary[]
}

export default function SidebarTabs({ conversations, properties }: Props) {
  const pathname = usePathname()
  const onProperties = pathname.startsWith('/dashboard/properties')

  return (
    <>
      <div className={styles.tabs}>
        <Link
          href="/dashboard"
          className={`${styles.tab} ${!onProperties ? styles.tabActive : ''}`}
        >
          Conversations
        </Link>
        <Link
          href="/dashboard/properties"
          className={`${styles.tab} ${onProperties ? styles.tabActive : ''}`}
        >
          Properties
        </Link>
      </div>
      {onProperties
        ? <PropertyNav properties={properties} />
        : <ConversationList conversations={conversations} />
      }
    </>
  )
}
