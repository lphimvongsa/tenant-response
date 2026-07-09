'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'
import { isConversationDetailPath } from '@/lib/utils/routes'
import styles from './ConversationsSplitView.module.css'

type Props = {
  list: ReactNode
  detail: ReactNode
}

// Desktop always shows both panes side by side (unchanged from before).
// Mobile shows exactly one, chosen by the current route — deep-linking and
// browser back/forward both fall out of this for free since usePathname()
// reflects the resolved route from the first client render.
export default function ConversationsSplitView({ list, detail }: Props) {
  const pathname = usePathname()
  const hasDetail = isConversationDetailPath(pathname)

  return (
    <div className={styles.container}>
      <div className={`${styles.listPane} ${hasDetail ? styles.hiddenMobile : ''}`}>
        {list}
      </div>
      <div className={`${styles.detailPane} ${!hasDetail ? styles.hiddenMobile : ''}`}>
        {detail}
      </div>
    </div>
  )
}
