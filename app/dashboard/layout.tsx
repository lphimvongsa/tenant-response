import IconSidebar from '@/components/sidebar/IconSidebar'
import styles from './dashboard.module.css'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className={styles.shell}>
      <IconSidebar />
      <main className={styles.main}>
        {children}
      </main>
    </div>
  )
}
