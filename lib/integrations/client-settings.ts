import { supabase as supabaseAdmin } from './supabase'
import type { BusinessHours } from '../utils/time'

// Data-access layer for the Settings page's "Business Settings" tab
// (business hours + escalation contact). Both live in JSONB columns on
// `clients` (ai_config.business_hours, escalation_config) that are read
// today by app/api/twilio/route.ts and lib/execute-flow.ts but, until this
// tab existed, had no UI to edit them at all.
//
// `clients` only has a SELECT RLS policy (manager_read_own_client in
// 003_rls.sql) — no write policy — so, same as lib/integrations/team.ts,
// every write here goes through the service-role client. The Server Action
// calling in is responsible for verifying the caller is an admin first.

export type EscalationConfig = {
  email?: string
  sms?: string
}

export type ClientSettings = {
  businessHours: BusinessHours | null
  escalationConfig: EscalationConfig
}

export async function getClientSettings(clientId: string): Promise<ClientSettings | null> {
  const { data, error } = await supabaseAdmin
    .from('clients')
    .select('ai_config, escalation_config')
    .eq('id', clientId)
    .single()

  if (error || !data) {
    console.error('getClientSettings: failed to load client', clientId, error)
    return null
  }

  const aiConfig = (data.ai_config ?? {}) as { business_hours?: BusinessHours }
  return {
    businessHours: aiConfig.business_hours ?? null,
    escalationConfig: (data.escalation_config ?? {}) as EscalationConfig,
  }
}

// ai_config can hold other keys (e.g. rent_policy, read by lib/ai/router.ts)
// alongside business_hours — merge rather than overwrite so this action
// can't silently clobber unrelated AI configuration.
export async function updateBusinessHours(
  clientId: string,
  businessHours: BusinessHours,
): Promise<{ error?: string }> {
  const { data: existing, error: fetchError } = await supabaseAdmin
    .from('clients')
    .select('ai_config')
    .eq('id', clientId)
    .single()

  if (fetchError || !existing) {
    console.error('updateBusinessHours: failed to load client', clientId, fetchError)
    return { error: 'Failed to load client settings.' }
  }

  const aiConfig = { ...(existing.ai_config ?? {}), business_hours: businessHours }

  const { error } = await supabaseAdmin
    .from('clients')
    .update({ ai_config: aiConfig })
    .eq('id', clientId)

  if (error) {
    console.error('updateBusinessHours: update failed', clientId, error)
    return { error: 'Failed to save business hours.' }
  }
  return {}
}

export async function updateEscalationConfig(
  clientId: string,
  config: EscalationConfig,
): Promise<{ error?: string }> {
  const { error } = await supabaseAdmin
    .from('clients')
    .update({ escalation_config: config })
    .eq('id', clientId)

  if (error) {
    console.error('updateEscalationConfig: update failed', clientId, error)
    return { error: 'Failed to save escalation contact.' }
  }
  return {}
}
