'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { getCurrentManager, createServerSupabaseClient } from '@/lib/integrations/supabase-auth'
import { updateOwnContactInfo, removeTeammate, regenerateJoinCode } from '@/lib/integrations/team'

// Shared result shape for every Settings server action. `emailConfirmation`
// is only set by updateProfileAction when the email change kicks off
// Supabase's own confirmation-link flow, so the UI can surface that note.
export type SettingsActionState =
  | { status: 'success'; message: string; emailConfirmation?: boolean }
  | { status: 'error'; message: string }
  | undefined

const SETTINGS_PATH = '/dashboard/settings'

// Updates the caller's own name/email (Supabase Auth) and phone (managers
// row). Only touches auth fields that actually changed. Changing the email
// triggers Supabase's confirmation-link flow to the NEW address — we don't
// do anything extra beyond telling the user to check their inbox.
export async function updateProfileAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const manager = await getCurrentManager()
  if (!manager) {
    // proxy.ts already gates /dashboard/**; defensive fallback.
    redirect('/')
  }

  const nameRaw = formData.get('name')
  const emailRaw = formData.get('email')
  const phoneRaw = formData.get('phone')

  const name = typeof nameRaw === 'string' ? nameRaw.trim() : ''
  const email = typeof emailRaw === 'string' ? emailRaw.trim() : ''
  const phone = typeof phoneRaw === 'string' ? phoneRaw.trim() : ''

  if (!name) {
    return { status: 'error', message: 'Name is required.' }
  }
  if (!email) {
    return { status: 'error', message: 'Email is required.' }
  }

  // Only send auth fields that changed. `manager.name` comes from
  // user_metadata.name and `manager.email` from the auth user, so these
  // comparisons line up with what updateUser would write.
  const authUpdate: { email?: string; data?: { name: string } } = {}
  if (name !== manager.name) {
    authUpdate.data = { name }
  }
  const emailChanged = email !== manager.email
  if (emailChanged) {
    authUpdate.email = email
  }

  if (authUpdate.email !== undefined || authUpdate.data !== undefined) {
    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.auth.updateUser(authUpdate)
    if (error) {
      return { status: 'error', message: error.message }
    }
  }

  const { error: contactError } = await updateOwnContactInfo(manager.managerId, {
    phone: phone || null,
  })
  if (contactError) {
    return { status: 'error', message: contactError }
  }

  revalidatePath(SETTINGS_PATH)

  if (emailChanged) {
    return {
      status: 'success',
      message:
        'Profile saved. Check your new email address for a confirmation link to finish the change.',
      emailConfirmation: true,
    }
  }

  return { status: 'success', message: 'Profile saved.' }
}

// Persists the two notification toggles. Unchecked checkboxes are omitted
// from FormData entirely, so presence in the payload means "on".
export async function updateNotificationPrefsAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const manager = await getCurrentManager()
  if (!manager) {
    redirect('/')
  }

  const notifyEmail = formData.get('notifyEmail') !== null
  const notifySms = formData.get('notifySms') !== null

  const { error } = await updateOwnContactInfo(manager.managerId, {
    notifyEmail,
    notifySms,
  })
  if (error) {
    return { status: 'error', message: error }
  }

  revalidatePath(SETTINGS_PATH)
  return { status: 'success', message: 'Notification preferences saved.' }
}

// Removes a teammate. Admin-only. We re-check the role here rather than
// trusting the UI (which already hides the control for non-admins) — the
// team.ts layer does NOT authorize, so this action is the gate.
export async function removeTeammateAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const manager = await getCurrentManager()
  if (!manager) {
    redirect('/')
  }

  if (manager.role !== 'admin') {
    return { status: 'error', message: 'Only admins can remove teammates.' }
  }

  const targetRaw = formData.get('targetManagerId')
  const targetManagerId = typeof targetRaw === 'string' ? targetRaw : ''
  if (!targetManagerId) {
    return { status: 'error', message: 'Missing teammate to remove.' }
  }

  const { error } = await removeTeammate(targetManagerId, manager.clientId, manager.managerId)
  if (error) {
    return { status: 'error', message: error }
  }

  revalidatePath(SETTINGS_PATH)
  return { status: 'success', message: 'Teammate removed.' }
}

// Rotates the client's join code. Admin-only — same defense-in-depth check
// as removeTeammateAction. Existing signed-up members are unaffected; only
// future invites using the old code stop working.
// Params are omitted deliberately: useActionState calls this with
// (prevState, formData), but regeneration reads neither. A function with
// fewer parameters is still assignable to the action type.
export async function regenerateJoinCodeAction(): Promise<SettingsActionState> {
  const manager = await getCurrentManager()
  if (!manager) {
    redirect('/')
  }

  if (manager.role !== 'admin') {
    return { status: 'error', message: 'Only admins can regenerate the join code.' }
  }

  try {
    await regenerateJoinCode(manager.clientId)
  } catch {
    return { status: 'error', message: 'Failed to regenerate the join code. Please try again.' }
  }

  revalidatePath(SETTINGS_PATH)
  return { status: 'success', message: 'Join code regenerated.' }
}
