import styles from '@/components/conversations/ConversationView.module.css'

function Block({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded [background:rgba(255,255,255,0.10)] ${className}`} />
}

export default function Loading() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={`${styles.headerAvatar} animate-pulse`} />
          <div className={styles.headerInfo}>
            <Block className="h-4 w-32" />
            <Block className="h-3 w-24" />
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-3 overflow-hidden p-6">
        <Block className="h-10 w-2/5 self-start !rounded-2xl" />
        <Block className="h-10 w-1/3 self-end !rounded-2xl" />
        <Block className="h-16 w-1/2 self-start !rounded-2xl" />
        <Block className="h-10 w-2/5 self-end !rounded-2xl" />
      </div>
    </div>
  )
}
