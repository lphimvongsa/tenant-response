import Link from 'next/link'
import { computeInitials } from '@/lib/utils/initials'
import styles from './ProfileMenu.module.css'

interface ProfileMenuProps {
  name: string
  email: string
}

// Avatar-circle link into account settings. Used to open a dropdown
// (settings / help / sign out) — sign out now lives on the settings page
// itself, and "help" wasn't worth a whole menu on its own.
export default function ProfileMenu({ name, email }: ProfileMenuProps) {
  const initials = computeInitials(name, email)

  return (
    <Link href="/dashboard/settings" className={styles.trigger} aria-label="Account settings">
      {initials}
    </Link>
  )
}
