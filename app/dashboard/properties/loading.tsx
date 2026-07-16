import styles from './properties.module.css'

export default function Loading() {
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>Properties</h1>
      </header>

      <div className={styles.grid}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className={styles.card}>
            <div className={`${styles.photoWrap} animate-pulse`} />
            <div className={styles.cardBody}>
              <div className="h-4 w-3/4 animate-pulse rounded [background:var(--color-bg-sunken)]" />
              <div className="mt-1 h-3 w-full animate-pulse rounded [background:var(--color-bg-sunken)]" />
              <div className="mt-2 h-3 w-1/2 animate-pulse rounded [background:var(--color-bg-sunken)]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
