import styles from './ConversationList.module.css'

function Block({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded [background:rgba(255,255,255,0.10)] ${className}`} />
}

export default function ConversationListSkeleton() {
  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Conversations</h1>
      </div>

      <div className={styles.searchWrap}>
        <Block className="h-[38px] w-full !rounded-xl" />
      </div>

      <nav className={styles.list} aria-label="Conversation list">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className={styles.item}>
            <Block className="h-12 w-12 flex-shrink-0 !rounded-2xl" />
            <div className={styles.content}>
              <Block className="h-3.5 w-2/3" />
              <Block className="h-3 w-full" />
            </div>
          </div>
        ))}
      </nav>
    </div>
  )
}
