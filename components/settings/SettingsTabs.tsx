'use client'

import { useActionState, useState, type ReactNode } from 'react'
import type { Teammate } from '@/lib/integrations/team'
import type { NotificationPrefs } from '@/lib/notification-events'
import type { BusinessHours } from '@/lib/utils/time'
import type { SettingsActionState } from '@/app/dashboard/settings/actions'
import {
  updateProfileAction,
  updateNotificationPrefsAction,
  updateBusinessSettingsAction,
} from '@/app/dashboard/settings/actions'
import { signOut } from '@/app/login/actions'
import { computeInitials } from '@/lib/utils/initials'
import { useIsMobile } from '@/lib/hooks/useIsMobile'
import ProfilePanel from './ProfilePanel'
import TeammatesPanel from './TeammatesPanel'
import NotificationsPanel from './NotificationsPanel'
import BusinessSettingsPanel from './BusinessSettingsPanel'
import GroupedSettingsList from './GroupedSettingsList'
import MobileSettingsPanel from './MobileSettingsPanel'

type TabId = 'profile' | 'teammates' | 'notifications' | 'business'

const PROFILE_FORM_ID = 'settings-profile-form'
const NOTIF_FORM_ID = 'settings-notifications-form'
const BUSINESS_FORM_ID = 'settings-business-form'

const UserIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)

const UsersIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)

const BellIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
)

const SignOutIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="m16 17 5-5-5-5" />
    <path d="M21 12H9" />
  </svg>
)

const BuildingIcon = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4" y="2" width="16" height="20" rx="1" />
    <path d="M9 22v-4h6v4" />
    <path d="M8 6h.01M12 6h.01M16 6h.01M8 10h.01M12 10h.01M16 10h.01M8 14h.01M12 14h.01M16 14h.01" />
  </svg>
)

interface SettingsTabsProps {
  managerId: string
  role: string
  name: string
  email: string
  phone: string
  notifyEmail: boolean
  notificationPrefs: NotificationPrefs
  businessHours: BusinessHours | null
  escalationEmail: string
  escalationSms: string
  teammates: Teammate[]
  joinCode: string | null
}

export default function SettingsTabs({
  managerId,
  role,
  name,
  email,
  phone,
  notifyEmail,
  notificationPrefs,
  businessHours,
  escalationEmail,
  escalationSms,
  teammates,
  joinCode,
}: SettingsTabsProps) {
  const isMobile = useIsMobile()
  const isAdmin = role === 'admin'
  const [activeTab, setActiveTab] = useState<TabId>('profile')
  const [mobileDrilldownOpen, setMobileDrilldownOpen] = useState(false)

  const [profileState, profileAction, profilePending] = useActionState<SettingsActionState, FormData>(
    updateProfileAction,
    undefined,
  )
  const [notifState, notifAction, notifPending] = useActionState<SettingsActionState, FormData>(
    updateNotificationPrefsAction,
    undefined,
  )
  const [businessState, businessAction, businessPending] = useActionState<SettingsActionState, FormData>(
    updateBusinessSettingsAction,
    undefined,
  )

  const initials = computeInitials(name, email)

  const tabs: { id: TabId; label: string; icon: ReactNode }[] = [
    { id: 'profile', label: 'Profile', icon: UserIcon },
    { id: 'teammates', label: 'Manage Teammates', icon: UsersIcon },
    { id: 'notifications', label: 'Notification Preferences', icon: BellIcon },
    { id: 'business', label: 'Business Settings', icon: BuildingIcon },
  ]

  // The "Save Changes" button lives in the header (matching the reference)
  // and submits whichever tab's form is active via the `form` attribute.
  // The Teammates tab has no single save form, so no button is shown there.
  // Business Settings only has a save form for admins — non-admins see a
  // read-only summary with nothing to submit.
  const saveTarget =
    activeTab === 'profile'
      ? { formId: PROFILE_FORM_ID, pending: profilePending }
      : activeTab === 'notifications'
        ? { formId: NOTIF_FORM_ID, pending: notifPending }
        : activeTab === 'business' && isAdmin
          ? { formId: BUSINESS_FORM_ID, pending: businessPending }
          : null

  const activeLabel = tabs.find((t) => t.id === activeTab)?.label ?? 'Settings'

  // Computed once, reused by the desktop tabpanel and the mobile drill-down
  // so the three-way switch isn't written twice.
  const activePanel =
    activeTab === 'profile' ? (
      <ProfilePanel
        formId={PROFILE_FORM_ID}
        name={name}
        email={email}
        phone={phone}
        initials={initials}
        state={profileState}
        formAction={profileAction}
      />
    ) : activeTab === 'teammates' ? (
      <TeammatesPanel
        role={role}
        managerId={managerId}
        teammates={teammates}
        joinCode={joinCode}
      />
    ) : activeTab === 'business' ? (
      <BusinessSettingsPanel
        formId={BUSINESS_FORM_ID}
        isAdmin={isAdmin}
        businessHours={businessHours}
        escalationEmail={escalationEmail}
        escalationSms={escalationSms}
        state={businessState}
        formAction={businessAction}
      />
    ) : (
      <NotificationsPanel
        formId={NOTIF_FORM_ID}
        notifyEmail={notifyEmail}
        notificationPrefs={notificationPrefs}
        state={notifState}
        formAction={notifAction}
      />
    )

  if (isMobile) {
    return (
      <div>
        <div>
          <h1 className="text-lg font-bold [color:var(--color-on-glass)]">Settings</h1>
          <p className="mt-1 text-sm [color:var(--color-on-glass-muted)]">
            Manage your profile, team, and notifications
          </p>
        </div>

        <GroupedSettingsList
          groups={[
            {
              title: 'Account',
              items: [
                { id: 'profile', label: 'Profile', icon: UserIcon },
                { id: 'notifications', label: 'Notification Preferences', icon: BellIcon },
              ],
            },
            {
              title: 'Team',
              items: [
                { id: 'teammates', label: 'Manage Teammates', icon: UsersIcon },
                { id: 'business', label: 'Business Settings', icon: BuildingIcon },
              ],
            },
          ]}
          onSelect={(id) => {
            setActiveTab(id as TabId)
            setMobileDrilldownOpen(true)
          }}
        />

        <form action={signOut} className="mt-6">
          <button
            type="submit"
            className="glass-panel glass-interactive flex w-full items-center gap-3 px-4 py-3.5 text-left"
          >
            <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg [background:rgba(214,69,69,0.24)] [color:#ffb4b4]">
              {SignOutIcon}
            </span>
            <span className="flex-1 text-sm font-semibold [color:#ffb4b4]">Sign out</span>
          </button>
        </form>

        {mobileDrilldownOpen && (
          <MobileSettingsPanel
            title={activeLabel}
            onBack={() => setMobileDrilldownOpen(false)}
            saveFormId={saveTarget?.formId}
            savePending={saveTarget?.pending}
          >
            {activePanel}
          </MobileSettingsPanel>
        )}
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold [color:var(--color-on-glass)]">Settings</h1>
          <p className="mt-1 text-sm [color:var(--color-on-glass-muted)]">
            Manage your profile, team, and notifications
          </p>
        </div>
        {saveTarget && (
          <button
            type="submit"
            form={saveTarget.formId}
            disabled={saveTarget.pending}
            className="shrink-0 rounded-[var(--radius-sm)] px-4 py-2 text-sm font-semibold shadow-[var(--glass-shadow)] transition-colors [background:var(--color-lavender-300)] [color:var(--color-ink)] hover:[background:var(--color-lavender-200)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saveTarget.pending ? 'Saving…' : 'Save Changes'}
          </button>
        )}
      </div>

      <nav
        role="tablist"
        aria-label="Settings sections"
        className="mt-4 flex items-center gap-6 overflow-x-auto border-b [border-color:var(--glass-border)]"
      >
        {tabs.map((tab) => {
          const active = tab.id === activeTab
          return (
            <button
              key={tab.id}
              id={`settings-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls="settings-tabpanel"
              onClick={() => setActiveTab(tab.id)}
              className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 pb-3 text-sm font-semibold transition-colors ${
                active
                  ? '[border-color:var(--color-on-glass)] [color:var(--color-on-glass)]'
                  : 'border-transparent [color:var(--color-on-glass-muted)] hover:[color:var(--color-on-glass)]'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          )
        })}
      </nav>

      <div
        id="settings-tabpanel"
        role="tabpanel"
        aria-labelledby={`settings-tab-${activeTab}`}
        aria-label={activeLabel}
        className="glass-panel mt-6 max-w-2xl p-6"
      >
        {activePanel}
      </div>

      <form action={signOut} className="mt-6">
        <button
          type="submit"
          className="flex items-center gap-2 rounded-[var(--radius-sm)] px-3 py-2 text-sm font-semibold transition-colors [color:#ffb4b4] hover:bg-white/10"
        >
          {SignOutIcon}
          Sign out
        </button>
      </form>
    </div>
  )
}
