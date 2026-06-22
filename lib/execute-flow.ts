import type { SupabaseClient } from '@supabase/supabase-js'
import type { RouterOutput } from './ai/router'

type FlowContext = {
  supabase: SupabaseClient
  clientId: string
  tenantId: string
  conversationId: string
  routerOutput: RouterOutput
  // URL of any photo already uploaded to Supabase Storage this request
  uploadedPhotoUrl: string | null
}

// ─── Maintenance ──────────────────────────────────────────────────────────────

async function handleMaintenance(ctx: FlowContext): Promise<void> {
  const { supabase, clientId, tenantId, conversationId, routerOutput, uploadedPhotoUrl } = ctx
  const { actionData } = routerOutput

  if (!actionData.ticketReady) return  // still gathering info — no ticket yet

  const category = actionData.maintenanceType ?? 'other'
  const location = actionData.maintenanceLocation ?? 'unspecified'
  const severity = actionData.maintenanceSeverity ?? 'moderate'
  const description = [
    actionData.maintenanceDescription,
    severity ? `Severity: ${severity}` : null,
  ].filter(Boolean).join(' | ') || '(no description)'

  // Check for an existing open ticket for this exact issue (same category + location
  // in this conversation). If found, update it — the tenant may be adding info or
  // the AI fired ticket_ready twice for the same gathering session.
  const { data: existing } = await supabase
    .from('tickets')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('category', category)
    .eq('location', location)
    .not('status', 'in', '("resolved","closed")')
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('tickets')
      .update({
        description,
        severity,
        ...(uploadedPhotoUrl ? { photo_url: uploadedPhotoUrl } : {}),
      })
      .eq('id', existing.id)

    if (error) {
      console.error(`[${clientId}] Failed to update ticket ${existing.id}:`, error)
    } else {
      console.log(`[${clientId}] Updated existing ticket ${existing.id}`)
    }
    return
  }

  // No existing ticket — create a new one
  const { error } = await supabase.from('tickets').insert({
    client_id: clientId,
    tenant_id: tenantId,
    conversation_id: conversationId,
    category,
    location,
    description,
    severity,
    status: 'open',
    photo_url: uploadedPhotoUrl ?? null,
  })

  if (error) {
    console.error(`[${clientId}] Failed to create maintenance ticket:`, error)
  } else {
    console.log(`[${clientId}] Maintenance ticket created for conversation ${conversationId}`)
  }
}

// ─── Maintenance update ───────────────────────────────────────────────────────

async function handleMaintenanceUpdate(ctx: FlowContext): Promise<void> {
  const { supabase, clientId, conversationId, routerOutput, uploadedPhotoUrl } = ctx
  const { actionData } = routerOutput

  // Find the most recent open ticket in this conversation
  const { data: ticket } = await supabase
    .from('tickets')
    .select('id')
    .eq('conversation_id', conversationId)
    .not('status', 'in', '("resolved","closed")')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!ticket) {
    console.log(`[${clientId}] maintenance_update: no open ticket found for conversation ${conversationId}`)
    return
  }

  if (actionData.ticketResolved) {
    const { error } = await supabase
      .from('tickets')
      .update({ status: 'resolved' })
      .eq('id', ticket.id)

    if (error) {
      console.error(`[${clientId}] Failed to resolve ticket ${ticket.id}:`, error)
    } else {
      console.log(`[${clientId}] Ticket ${ticket.id} resolved by tenant`)
    }
    return
  }

  // Severity / photo / description update
  const updates: Record<string, unknown> = {}
  if (actionData.maintenanceSeverity) updates.severity = actionData.maintenanceSeverity
  if (actionData.maintenanceDescription) updates.description = actionData.maintenanceDescription
  if (uploadedPhotoUrl) updates.photo_url = uploadedPhotoUrl

  if (Object.keys(updates).length === 0) return

  const { error } = await supabase
    .from('tickets')
    .update(updates)
    .eq('id', ticket.id)

  if (error) {
    console.error(`[${clientId}] Failed to update ticket ${ticket.id}:`, error)
  } else {
    console.log(`[${clientId}] Updated ticket ${ticket.id}`)
  }
}

// ─── Emergency ────────────────────────────────────────────────────────────────

async function handleEmergency(ctx: FlowContext): Promise<void> {
  const { supabase, clientId, conversationId } = ctx

  // Mark conversation as escalated so the dashboard surfaces it immediately
  const { error: convError } = await supabase
    .from('conversations')
    .update({ status: 'escalated' })
    .eq('id', conversationId)

  if (convError) {
    console.error(`[${clientId}] Failed to escalate conversation:`, convError)
  }

  // Fetch escalation contact for this client
  const { data: client } = await supabase
    .from('clients')
    .select('escalation_config, name')
    .eq('id', clientId)
    .single()

  if (!client) return

  const escalationConfig = client.escalation_config as {
    email?: string
    sms?: string
  } | null

  // SMS notification to escalation contact
  if (escalationConfig?.sms) {
    const { twilioClient } = await import('./integrations/twilio')
    try {
      await twilioClient.messages.create({
        body: `URGENT: A tenant has reported an emergency. Check the dashboard immediately. Conversation: ${conversationId}`,
        from: process.env.TWILIO_PHONE_NUMBER!,
        to: escalationConfig.sms,
      })
      console.log(`[${clientId}] Emergency alert sent to ${escalationConfig.sms}`)
    } catch (err) {
      console.error(`[${clientId}] Failed to send emergency SMS alert:`, err)
    }
  }

  // Log to actions_log for audit trail
  await supabase.from('actions_log').insert({
    client_id: clientId,
    conversation_id: conversationId,
    tool: 'escalate_emergency',
    args: { escalation_config: escalationConfig },
    result: { status: 'escalated' },
  })
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export async function executeFlow(ctx: FlowContext): Promise<void> {
  const { routerOutput, clientId, conversationId } = ctx

  switch (routerOutput.intent) {
    case 'maintenance':
      await handleMaintenance(ctx)
      break
    case 'maintenance_update':
      await handleMaintenanceUpdate(ctx)
      break
    case 'emergency':
      await handleEmergency(ctx)
      break
    case 'late_rent':
    case 'general':
      // No DB side-effects — response_text from the AI is sufficient
      break
  }

  // Every AI response is logged for auditing
  await ctx.supabase.from('actions_log').insert({
    client_id: clientId,
    conversation_id: conversationId,
    tool: 'ai_response',
    args: { intent: routerOutput.intent, action_data: routerOutput.actionData },
    result: { response_text: routerOutput.responseText },
  })
}
