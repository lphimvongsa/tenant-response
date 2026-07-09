import { randomBytes } from 'crypto'
import { supabase as supabaseAdmin } from '@/lib/integrations/supabase'

// Data-access layer for the Settings page's "Manage Teammates" tab.
//
// All functions here use the service-role client because they need to read
// or write rows belonging to managers *other than* the caller (teammate
// lists, join-code rotation, removal) — RLS policies in
// supabase/migrations/003_rls.sql only ever grant a manager access to their
// own `managers` row (manager_read_own_row), so a session-scoped client
// cannot serve this feature at all. None of the functions below check
// `role === 'admin'` themselves — the Server Action layer calling in must
// verify authorization via getCurrentManager() first. See the per-function
// comments on regenerateJoinCode/removeTeammate for the two operations where
// this matters most (join code rotation, removing another manager).

export type Teammate = {
  id: string
  name: string
  email: string
  phone: string | null
  role: string
}

// Lists every manager for a client, resolving name/email from Supabase Auth
// (auth.users isn't queryable directly — admin.getUserById is the supported
// path). Per-row lookups are fine here: teams are small (property management
// staff, not end users), so there's no need for the batch listUsers() API.
export async function getTeammates(clientId: string): Promise<Teammate[]> {
  const { data: managers, error } = await supabaseAdmin
    .from('managers')
    .select('id, supabase_user_id, role, phone')
    .eq('client_id', clientId)

  if (error || !managers) {
    console.error('getTeammates: failed to load managers', error)
    return []
  }

  const teammates = await Promise.all(
    managers.map(async (m) => {
      const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(
        m.supabase_user_id,
      )

      if (userError || !userData?.user) {
        console.error('getTeammates: failed to resolve auth user', m.supabase_user_id, userError)
        return { id: m.id, name: '', email: '', phone: m.phone, role: m.role }
      }

      const user = userData.user
      return {
        id: m.id,
        name: (user.user_metadata?.name as string) ?? '',
        email: user.email ?? '',
        phone: m.phone,
        role: m.role,
      }
    }),
  )

  return teammates
}

// Returns the client's current invite join code, or null if the client row
// isn't found (shouldn't happen for a valid clientId, but callers should
// treat null as "couldn't load" rather than crash).
export async function getJoinCode(clientId: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('clients')
    .select('join_code')
    .eq('id', clientId)
    .single()

  if (error || !data) {
    console.error('getJoinCode: failed to load client', clientId, error)
    return null
  }

  return data.join_code
}

// Rotates a client's join code. Caller must verify the requester is an
// 'admin' before calling this — anyone who can call this function can
// invalidate the existing invite link for the whole team.
//
// Collisions against clients.join_code's UNIQUE constraint are astronomically
// unlikely at this scale (8 hex chars = 4.3 billion possibilities against a
// handful of clients) — intentionally no retry-loop here.
export async function regenerateJoinCode(clientId: string): Promise<string> {
  const newCode = randomBytes(4).toString('hex')

  const { error } = await supabaseAdmin
    .from('clients')
    .update({ join_code: newCode })
    .eq('id', clientId)

  if (error) {
    throw new Error(`regenerateJoinCode: failed to update client ${clientId}: ${error.message}`)
  }

  return newCode
}

// Removes a teammate from a client's team. Caller must verify the requester
// is an 'admin' before calling this.
//
// clientId scoping on the delete is a deliberate second guard: even if a
// managerId were guessed or forged by a caller, the delete can only ever
// affect a row that also belongs to this client, so it can't be used to
// remove a manager from an unrelated tenant.
export async function removeTeammate(
  managerId: string,
  clientId: string,
  requesterManagerId: string,
): Promise<{ error?: string }> {
  if (managerId === requesterManagerId) {
    return { error: 'You cannot remove yourself.' }
  }

  const { data, error } = await supabaseAdmin
    .from('managers')
    .delete()
    .eq('id', managerId)
    .eq('client_id', clientId)
    .select('id')

  if (error) {
    console.error('removeTeammate: delete failed', managerId, clientId, error)
    return { error: 'Failed to remove teammate.' }
  }

  if (!data || data.length === 0) {
    return { error: 'Teammate not found.' }
  }

  return {}
}

// Updates the caller's own contact info / notification preferences. Only
// ever writes phone/notify_email/notify_sms — this function must NEVER
// accept or write `role` or `client_id`, since those are the
// privilege-escalation boundary (a manager updating their own role to
// 'admin', or reassigning themselves to a different client, would bypass
// the authorization model entirely). Keep this signature narrow even if a
// future caller asks for more fields.
export async function updateOwnContactInfo(
  managerId: string,
  fields: { phone?: string | null; notifyEmail?: boolean; notifySms?: boolean },
): Promise<{ error?: string }> {
  const update: Record<string, string | boolean | null> = {}
  if ('phone' in fields) update.phone = fields.phone ?? null
  if ('notifyEmail' in fields) update.notify_email = fields.notifyEmail as boolean
  if ('notifySms' in fields) update.notify_sms = fields.notifySms as boolean

  if (Object.keys(update).length === 0) {
    return {}
  }

  const { error } = await supabaseAdmin.from('managers').update(update).eq('id', managerId)

  if (error) {
    console.error('updateOwnContactInfo: update failed', managerId, error)
    return { error: 'Failed to update contact info.' }
  }

  return {}
}
