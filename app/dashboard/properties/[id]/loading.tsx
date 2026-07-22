import styles from '@/components/properties/PropertyProfile.module.css'

function Block({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-white/10 ${className}`} />
}

export default function Loading() {
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <Block className="h-4 w-32" />

        <div className={styles.profileCard}>
          <div className={styles.photoColumn}>
            <div className={`${styles.photoFrame} animate-pulse`} />
          </div>
          <div className={styles.infoColumn}>
            <Block className="h-5 w-1/2" />
            <Block className="h-4 w-1/3" />
            <div className={styles.stats}>
              {[0, 1, 2].map((i) => (
                <Block key={i} className="h-16 w-24" />
              ))}
            </div>
          </div>
        </div>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <Block className="h-3 w-24" />
          </div>
          <div className={styles.unitList}>
            {[0, 1, 2].map((i) => (
              <Block key={i} className="h-20" />
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
