'use client'

import { useRouter } from 'next/navigation'
import styles from './RefreshButton.module.css'

export default function RefreshButton() {
  const router = useRouter()

  return (
    <button onClick={() => router.refresh()} className={styles.button}>
      Refresh
    </button>
  )
}
