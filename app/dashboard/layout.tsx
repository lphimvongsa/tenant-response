import IconSidebar from '@/components/sidebar/IconSidebar'
import TopHeader from '@/components/ui/TopHeader'
import styles from './dashboard.module.css'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className={styles.shell}>
      <IconSidebar />
      <div className={styles.right}>
        <TopHeader />
        <main className={styles.main}>
          {children}
        </main>
      </div>
    </div>
  )
}
