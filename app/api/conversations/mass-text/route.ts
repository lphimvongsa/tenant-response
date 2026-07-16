import { revalidateTag } from 'next/cache'
import { supabase } from '@/lib/integrations/supabase'
import { getCurrentManager } from '@/lib/integrations/supabase-auth'
import { twilioClient } from '@/lib/integrations/twilio'
import { CONVERSATIONS_TAG } from '@/lib/cache-tags'
import type { NextRequest } from 'next/server'
import type { MassTextResult, MassTextResponse } from '@/types'

// Safety valve against very long-running requests — not a real product
// limit. All sends for a client share one Twilio number, so a large blast
// takes N * ~120ms+ inside a single request (see the sequential loop below).
const MAX_RECIPIENTS = 500

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function POST(request: NextRequest) {
  const manager = await getCurrentManager()
  if (!manager) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Parse and validate body
  let tenantIds: unknown
  let body: string
  try {
    const json = await request.json()
    tenantIds = json?.tenantIds
    body = json?.body
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (
    !Array.isArray(tenantIds) ||
    tenantIds.length === 0 ||
    !tenantIds.every((tid) => typeof tid === 'string')
  ) {
    return new Response(
      JSON.stringify({ error: 'tenantIds must be a non-empty array of strings' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    )
  }

  if (!body || typeof body !== 'string' || body.trim() === '') {
    return new Response(JSON.stringify({ error: 'body must be a non-empty string' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const dedupedIds = [...new Set(tenantIds)]

  if (dedupedIds.length > MAX_RECIPIENTS) {
    return new Response(JSON.stringify({ error: 'Too many recipients' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Fetch the client's Twilio number once, before any per-tenant sends.
  const { data: client } = await supabase
    .from('clients')
    .select('twilio_number')
    .eq('id', manager.clientId)
    .single()

  if (!client) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Re-fetch the requested tenants scoped to this client — never trust the
  // client-submitted id list as already belonging to this client's tenants.
  const { data: tenants, error: tenantsError } = await supabase
    .from('tenants')
    .select('id, name, phone')
    .in('id', dedupedIds)
    .eq('client_id', manager.clientId)

  if (tenantsError) {
    console.error('Failed to fetch tenants for mass text:', tenantsError)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const foundTenants = tenants ?? []
  const foundIds = new Set(foundTenants.map((t) => t.id))

  const results: MassTextResult[] = []

  // Ids that didn't resolve to a tenant owned by this client — don't
  // distinguish "belongs to another client" from "doesn't exist" so we
  // never leak cross-tenant existence.
  for (const tenantId of dedupedIds) {
    if (!foundIds.has(tenantId)) {
      results.push({
        tenantId,
        tenantName: null,
        phone: '',
        status: 'failed',
        error: 'Tenant not found',
      })
    }
  }

  // Sequential (not Promise.all) — all sends for this client share one
  // Twilio number with a real per-second throughput limit.
  for (let i = 0; i < foundTenants.length; i++) {
    const tenant = foundTenants[i]
    let result: MassTextResult

    // Find-or-create an active/escalated conversation for this tenant,
    // mirroring the pattern in app/api/twilio/route.ts.
    const { data: existingConv } = await supabase
      .from('conversations')
      .select('id')
      .eq('tenant_id', tenant.id)
      .eq('client_id', manager.clientId)
      .in('status', ['active', 'escalated'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    let conversationId: string | null = existingConv?.id ?? null

    if (!conversationId) {
      const { data: newConv, error: convError } = await supabase
        .from('conversations')
        .insert({
          client_id: manager.clientId,
          tenant_id: tenant.id,
          channel: 'sms',
          status: 'active',
        })
        .select('id')
        .single()

      if (convError || !newConv) {
        console.error('Failed to create conversation for mass text:', convError)
      } else {
        conversationId = newConv.id
      }
    }

    if (!conversationId) {
      result = {
        tenantId: tenant.id,
        tenantName: tenant.name,
        phone: tenant.phone,
        status: 'failed',
        error: 'Failed to create conversation',
      }
    } else {
      try {
        const outbound = await twilioClient.messages.create({
          body,
          from: client.twilio_number,
          to: tenant.phone,
        })

        const { data: message, error: insertError } = await supabase
          .from('messages')
          .insert({
            client_id: manager.clientId,
            conversation_id: conversationId,
            direction: 'outbound',
            body,
            twilio_sid: outbound.sid,
            sender_type: 'human',
            ai_generated: false,
            status: 'sent',
          })
          .select()
          .single()

        if (insertError || !message) {
          console.error('Failed to store mass-text message:', insertError)
          result = {
            tenantId: tenant.id,
            tenantName: tenant.name,
            phone: tenant.phone,
            status: 'failed',
            error: 'Internal server error',
          }
        } else {
          result = {
            tenantId: tenant.id,
            tenantName: tenant.name,
            phone: tenant.phone,
            status: 'sent',
            conversationId,
            messageId: message.id,
          }
        }
      } catch (err) {
        console.error('Failed to send SMS via Twilio:', err)
        result = {
          tenantId: tenant.id,
          tenantName: tenant.name,
          phone: tenant.phone,
          status: 'failed',
          error: 'Failed to send SMS',
        }
      }
    }

    results.push(result)

    if (i < foundTenants.length - 1) {
      await sleep(120)
    }
  }

  revalidateTag(CONVERSATIONS_TAG, { expire: 0 })

  const sent = results.filter((r) => r.status === 'sent').length
  const failed = results.filter((r) => r.status === 'failed').length

  const response: MassTextResponse = {
    total: results.length,
    sent,
    failed,
    results,
  }

  return new Response(JSON.stringify(response), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
