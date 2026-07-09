'use client'

import { useSyncExternalStore } from 'react'

// Keep in sync with Tailwind's `md` breakpoint (768px) — Tailwind v4 is
// CSS-first (no config file to import this from), so every mobile/desktop
// fork in the app must use this exact value or the JS and CSS breakpoints
// will disagree.
const QUERY = '(max-width: 767px)'

function subscribe(callback: () => void) {
  const mql = window.matchMedia(QUERY)
  mql.addEventListener('change', callback)
  return () => mql.removeEventListener('change', callback)
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches
}

function getServerSnapshot() {
  return false
}

// Client-only signal for structural forks that own state/modals/effects
// (Maintenance board-vs-list, Settings tabs-vs-drilldown). Purely visual
// chrome switches (sidebar/header/tab bar) should use CSS `md:` classes
// instead — see components/sidebar/MobileTabBar.tsx for that pattern.
export function useIsMobile(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
