'use client'

import { useActionState, useState, type ReactNode } from 'react'
import type { Teammate } from '@/lib/integrations/team'
import type { SettingsActionState } from '@/app/dashboard/settings/actions'
import { updateProfileAction, updateNotificationPrefsAction } from '@/app/dashboard/settings/actions'
import { computeInitials } from '@/lib/utils/initials'
import ProfilePanel from './ProfilePanel'
import TeammatesPanel from './TeammatesPanel'
import NotificationsPanel from './NotificationsPanel'

type TabId = 'profile' | 'teammates' | 'notifications'

const PROFILE_FORM_ID = 'settings-profile-form'
const NOTIF_FORM_ID = 'settings-notifications-form'

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

interface SettingsTabsProps {
  managerId: string
  role: string
  name: string
  email: string
  phone: string
  notifyEmail: boolean
  notifySms: boolean
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
  notifySms,
  teammates,
  joinCode,
}: SettingsTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('profile')

  const [profileState, profileAction, profilePending] = useActionState<SettingsActionState, FormData>(
    updateProfileAction,
    undefined,
  )
  const [notifState, notifAction, notifPending] = useActionState<SettingsActionState, FormData>(
    updateNotificationPrefsAction,
    undefined,
  )

  const initials = computeInitials(name, email)

  const tabs: { id: TabId; label: string; icon: ReactNode }[] = [
    { id: 'profile', label: 'Profile', icon: UserIcon },
    { id: 'teammates', label: 'Manage Teammates', icon: UsersIcon },
    { id: 'notifications', label: 'Notification Preferences', icon: BellIcon },
  ]

  // The "Save Changes" button lives in the header (matching the reference)
  // and submits whichever tab's form is active via the `form` attribute.
  // The Teammates tab has no single save form, so no button is shown there.
  const saveTarget =
    activeTab === 'profile'
      ? { formId: PROFILE_FORM_ID, pending: profilePending }
      : activeTab === 'notifications'
        ? { formId: NOTIF_FORM_ID, pending: notifPending }
        : null

  const activeLabel = tabs.find((t) => t.id === activeTab)?.label ?? 'Settings'

  return (
    <div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold [color:var(--color-text-primary)]">Settings</h1>
          <p className="mt-1 text-sm [color:var(--color-text-secondary)]">
            Manage your profile, team, and notifications
          </p>
        </div>
        {saveTarget && (
          <button
            type="submit"
            form={saveTarget.formId}
            disabled={saveTarget.pending}
            className="shrink-0 rounded-[var(--radius-sm)] px-4 py-2 text-sm font-semibold text-white shadow-[var(--shadow-button)] transition-shadow [background:var(--color-brand-gradient)] hover:shadow-[var(--shadow-button-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saveTarget.pending ? 'Saving…' : 'Save Changes'}
          </button>
        )}
      </div>

      <nav
        role="tablist"
        aria-label="Settings sections"
        className="mt-4 flex items-center gap-6 overflow-x-auto border-b [border-color:var(--color-border)]"
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
                  ? '[border-color:var(--color-brand-dark)] [color:var(--color-brand-dark)]'
                  : 'border-transparent [color:var(--color-text-secondary)] hover:[color:var(--color-text-primary)]'
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
        className="mt-6 max-w-2xl rounded-2xl border p-6 shadow-[var(--shadow-card)] [background:var(--color-bg-surface)] [border-color:var(--color-border)]"
      >
        {activeTab === 'profile' && (
          <ProfilePanel
            formId={PROFILE_FORM_ID}
            name={name}
            email={email}
            phone={phone}
            initials={initials}
            state={profileState}
            formAction={profileAction}
          />
        )}

        {activeTab === 'teammates' && (
          <TeammatesPanel
            role={role}
            managerId={managerId}
            teammates={teammates}
            joinCode={joinCode}
          />
        )}

        {activeTab === 'notifications' && (
          <NotificationsPanel
            formId={NOTIF_FORM_ID}
            notifyEmail={notifyEmail}
            notifySms={notifySms}
            state={notifState}
            formAction={notifAction}
          />
        )}
      </div>
    </div>
  )
}
