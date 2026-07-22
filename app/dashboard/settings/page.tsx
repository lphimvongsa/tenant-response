import { redirect } from 'next/navigation'
import { supabase } from '@/lib/integrations/supabase'
import { getCurrentManager } from '@/lib/integrations/supabase-auth'
import { getTeammates, getJoinCode } from '@/lib/integrations/team'
import { getClientSettings } from '@/lib/integrations/client-settings'
import SettingsTabs from '@/components/settings/SettingsTabs'

export default async function SettingsPage() {
  const manager = await getCurrentManager()
  if (!manager) {
    // proxy.ts already gates /dashboard/**; this is a defensive fallback.
    redirect('/')
  }

  // One trip each for: the caller's own contact/notification fields
  // (getCurrentManager doesn't return phone or notify prefs), the team list
  // (everyone sees it), the join code (admins only — no point fetching it
  // otherwise), and the org-level business hours/escalation contact
  // (everyone can view it, only admins can edit — see BusinessSettingsPanel).
  // Service-role client bypasses RLS, so the managers query is scoped by hand.
  const [profileResult, teammates, joinCode, clientSettings] = await Promise.all([
    supabase
      .from('managers')
      .select('phone, notify_email, notification_prefs')
      .eq('id', manager.managerId)
      .eq('client_id', manager.clientId)
      .single(),
    getTeammates(manager.clientId),
    manager.role === 'admin' ? getJoinCode(manager.clientId) : Promise.resolve(null),
    getClientSettings(manager.clientId),
  ])

  if (profileResult.error) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-md rounded-[var(--radius-md)] border p-6 text-center [background:var(--color-danger-bg)] [border-color:var(--color-danger)]">
          <p className="text-sm font-semibold [color:var(--color-danger)]">
            Unable to load your settings
          </p>
          <p className="mt-1 text-sm [color:var(--color-danger)]">{profileResult.error.message}</p>
        </div>
      </div>
    )
  }

  const profile = profileResult.data

  return (
    <div className="flex-1 overflow-y-auto px-4 py-5 pb-[calc(var(--bottom-nav-height)+1.5rem)] md:px-8 md:py-7 md:pb-7">
      <SettingsTabs
        managerId={manager.managerId}
        role={manager.role}
        name={manager.name}
        email={manager.email}
        phone={profile.phone ?? ''}
        // Opt-out model: absent/null preference defaults to "on".
        notifyEmail={profile.notify_email ?? true}
        notificationPrefs={profile.notification_prefs ?? {}}
        businessHours={clientSettings?.businessHours ?? null}
        escalationEmail={clientSettings?.escalationConfig.email ?? ''}
        escalationSms={clientSettings?.escalationConfig.sms ?? ''}
        teammates={teammates}
        joinCode={joinCode}
      />
    </div>
  )
}
