import IconSidebar from '@/components/sidebar/IconSidebar'
import MobileTabBar from '@/components/sidebar/MobileTabBar'
import PushRegistration from '@/components/notifications/PushRegistration'
import { getCurrentManager } from '@/lib/integrations/supabase-auth'
import styles from './dashboard.module.css'

// No top header bar on any breakpoint — the profile menu (account settings /
// help / sign out) lives in IconSidebar (desktop) and MobileTabBar (mobile)
// instead. getCurrentManager() is cache()-wrapped, so fetching it here adds
// no extra Supabase round trip alongside each page's own call.
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const manager = await getCurrentManager()
  const name = manager?.name ?? ''
  const email = manager?.email ?? ''

  return (
    <div className={styles.shell}>
      <IconSidebar name={name} email={email} />
      <div className={styles.right}>
        <PushRegistration />
        <main className={styles.main}>
          {children}
        </main>
        <MobileTabBar name={name} email={email} />
      </div>
    </div>
  )
}
