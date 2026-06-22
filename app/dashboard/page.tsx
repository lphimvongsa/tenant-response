import styles from './dashboard.module.css'

export default function DashboardPage() {
  return (
    <div className={styles.emptyState}>
      <p>Select a conversation to get started.</p>
    </div>
  )
}
