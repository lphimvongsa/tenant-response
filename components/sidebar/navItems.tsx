// Shared nav taxonomy for the desktop icon sidebar and the mobile bottom tab
// bar — kept in one place so the two can't drift out of sync with each other.

export type NavItem = {
  label: string
  href: string
  icon: React.ReactNode
  // Whether the route should match exactly or by prefix
  exact?: boolean
  // True only for the account-menu entry. Consumers that render it inline
  // (MobileTabBar) special-case this to render a ProfileMenu trigger instead
  // of a plain Link; consumers that pin it elsewhere (IconSidebar) filter it
  // out of the main nav list entirely.
  profile?: boolean
}

export const HomeIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 9.5 12 3l9 6.5" />
    <path d="M5 9.5V21h14V9.5" />
    <path d="M9 21v-6h6v6" />
  </svg>
)

export const ChatIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
  </svg>
)

export const BuildingIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4" y="3" width="16" height="18" rx="1" />
    <path d="M9 7h2M9 11h2M9 15h2M13 7h2M13 11h2M13 15h2" />
    <path d="M9 21v-3h6v3" />
  </svg>
)

export const WrenchIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M14.7 6.3a4 4 0 0 0-5.3 5.3l-6 6a1.5 1.5 0 0 0 2.1 2.1l6-6a4 4 0 0 0 5.3-5.3l-2.4 2.4-2.1-2.1 2.4-2.4z" />
  </svg>
)

export const NAV_ITEMS: NavItem[] = [
  { label: 'Overview', href: '/dashboard', icon: HomeIcon, exact: true },
  { label: 'Conversations', href: '/dashboard/conversations', icon: ChatIcon },
  { label: 'Properties', href: '/dashboard/properties', icon: BuildingIcon },
  { label: 'Maintenance', href: '/dashboard/maintenance', icon: WrenchIcon },
  { label: 'Profile', href: '/dashboard/settings', icon: null, profile: true },
]

export function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href
  return pathname === item.href || pathname.startsWith(`${item.href}/`)
}
