import { deepseek, DEEPSEEK_MODEL } from './deepseek'
import type { BusinessHours } from '../utils/time'
import { MAINTENANCE_CATEGORIES } from '../maintenance-categories'

// ─── Types ────────────────────────────────────────────────────────────────────

export type Intent = 'maintenance' | 'maintenance_update' | 'emergency' | 'late_rent' | 'general'

export type ActionData = {
  // maintenance
  ticketReady?: boolean
  maintenanceType?: string
  maintenanceTitle?: string
  maintenanceLocation?: string
  maintenanceSeverity?: string
  maintenanceDescription?: string
  needsPhoto?: boolean
  // maintenance_update
  ticketResolved?: boolean
  // emergency
  confirmedEmergency?: boolean
}

export type RouterOutput = {
  intent: Intent
  responseText: string
  actionData: ActionData
}

type HistoryMessage = {
  direction: 'inbound' | 'outbound'
  body: string
  sender_type: string
}

type RouterInput = {
  clientName: string
  aiConfig: {
    business_hours?: BusinessHours
    rent_policy?: string
  }
  history: HistoryMessage[]   // last N messages, oldest first
  inboundBody: string
  hasMedia: boolean
}

// ─── Maintenance intake script ────────────────────────────────────────────────
// Issue type is inferred by the AI from the tenant's own words — never asked for.

export const MAINTENANCE_INTAKE_SCRIPT =
  "I'm sorry for the inconvenience. Please answer these questions so I can submit a maintenance ticket request:\n(1) Where is the issue located?\n(2) How severe is the issue? (Mild, Moderate, Severe)\n(3) Are you able to send a photo?"

// ─── Tool definition ──────────────────────────────────────────────────────────

const ROUTE_TOOL = {
  type: 'function' as const,
  function: {
    name: 'route_message',
    description: 'Classify the tenant message and produce a response',
    parameters: {
      type: 'object',
      properties: {
        intent: {
          type: 'string',
          enum: ['maintenance', 'maintenance_update', 'emergency', 'late_rent', 'general'],
          description: 'The classified intent of the tenant message',
        },
        response_text: {
          type: 'string',
          description: 'The SMS reply to send to the tenant. Keep under 160 chars when possible.',
        },
        action_data: {
          type: 'object',
          properties: {
            ticket_ready: {
              type: 'boolean',
              description: 'maintenance only — true once you have location AND severity (issue type and title are yours to infer, never ask the tenant for them)',
            },
            maintenance_type: {
              type: 'string',
              enum: [...MAINTENANCE_CATEGORIES],
              description: "maintenance only — infer this yourself from what the tenant describes; do NOT ask the tenant to pick one. Use 'other' only if nothing else fits.",
            },
            maintenance_title: {
              type: 'string',
              description: "maintenance only — a short 2-5 word ticket title summarizing the issue, written by you (e.g. 'Leaking faucet', 'Paint chipping', 'Lawn mowing'). This is NOT the full description — keep it brief, do not include location or severity.",
            },
            maintenance_location: {
              type: 'string',
              description: 'maintenance only — where the issue is (e.g. kitchen, bathroom, bedroom)',
            },
            maintenance_severity: {
              type: 'string',
              description: 'maintenance only — mild, moderate, or severe',
            },
            maintenance_description: {
              type: 'string',
              description: 'maintenance only — the fuller description of the issue in the tenant\'s own words (distinct from maintenance_title, which is a short summary)',
            },
            needs_photo: {
              type: 'boolean',
              description: 'maintenance only — true after asking the tenant to send a photo',
            },
            ticket_resolved: {
              type: 'boolean',
              description: 'maintenance_update only — true when the tenant says the issue is fixed or no longer a problem',
            },
            confirmed_emergency: {
              type: 'boolean',
              description: 'emergency only — true once the situation is confirmed as an emergency',
            },
          },
        },
      },
      required: ['intent', 'response_text'],
    },
  },
}

// ─── System prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(clientName: string, rentPolicy: string | undefined): string {
  return `You are an AI assistant for ${clientName}, a property management company.
You respond to tenant SMS messages. Be professional, concise, and warm.
Keep replies under 160 characters whenever possible.

INTENT CLASSIFICATION RULES:
- maintenance: Tenant reports a NEW repair or maintenance issue (broken appliance, leak, no heat, etc.)
  → Your FIRST reply MUST be this exact text, word-for-word (this message is allowed to exceed 160 chars):
    "${MAINTENANCE_INTAKE_SCRIPT}"
  → Set needs_photo=true when sending that message.
  → Do NOT ask the tenant what type of issue it is — infer maintenance_type and write maintenance_title yourself from their own description, as soon as you have enough detail to do so.
  → Set ticket_ready=true once you have location AND severity — a photo is optional, do not block the ticket on it.
  → Once ticket_ready=true, confirm the ticket has been submitted.
- maintenance_update: Tenant is referencing an issue they already reported — they are changing the severity, sending a new photo, or saying the issue is resolved / no longer a problem.
  → Do NOT send the intake questions again.
  → If updating severity or adding details: acknowledge the update, set the relevant fields (maintenance_severity, maintenance_description, maintenance_type/maintenance_title if the new details change what the issue actually is, etc.) and set ticket_ready=true.
  → If tenant says the issue is fixed or no longer a problem: acknowledge and set ticket_resolved=true.
- emergency: Tenant reports a life-safety issue (gas leak, fire, flooding, no heat below freezing, break-in, medical).
  → Respond immediately with urgency. Do NOT ask clarifying questions.
  → Set confirmed_emergency=true.
- late_rent: Tenant says they cannot pay rent on time or will be late.
  → Your reply MUST follow this exact structure (this message is allowed to exceed 160 chars):
    "Thank you for letting us know. [insert rent policy here]. Do you have any other questions you would like me to notify a representative about?"
  → Replace [insert rent policy here] with the RENT POLICY content below, summarized naturally in 1-2 sentences. Do not add any other text before or after this template.
- general: Anything else — questions, greetings, general inquiries.
  → Answer helpfully from context. If you don't know, say the team will follow up.

RENT POLICY:
${rentPolicy ?? 'Please contact our office directly regarding rent payment questions.'}

Never invent property details, lease terms, or dollar amounts you were not given.
Never mention that you are an AI unless directly asked.`
}

// ─── Main router function ─────────────────────────────────────────────────────

export async function runAiRouter(input: RouterInput): Promise<RouterOutput> {
  const { clientName, aiConfig, history, inboundBody, hasMedia } = input

  const chatMessages: { role: 'user' | 'assistant'; content: string }[] = history.map((m) => ({
    role: m.direction === 'inbound' ? 'user' : 'assistant',
    content: m.body,
  }))

  const latestContent = hasMedia
    ? `${inboundBody} [tenant attached a photo]`.trim()
    : inboundBody

  if (chatMessages.at(-1)?.role !== 'user' || chatMessages.at(-1)?.content !== inboundBody) {
    chatMessages.push({ role: 'user', content: latestContent })
  }

  const completion = await deepseek.chat.completions.create({
    model: DEEPSEEK_MODEL,
    messages: [
      { role: 'system', content: buildSystemPrompt(clientName, aiConfig.rent_policy) },
      ...chatMessages,
    ],
    tools: [ROUTE_TOOL],
    tool_choice: { type: 'function', function: { name: 'route_message' } },
    temperature: 0.3,
    max_tokens: 512,
  })

  const toolCall = completion.choices[0]?.message?.tool_calls?.[0]
  if (!toolCall || toolCall.type !== 'function') {
    throw new Error('AI router: no function tool call returned')
  }

  const raw = JSON.parse(toolCall.function.arguments) as {
    intent: Intent
    response_text: string
    action_data?: {
      ticket_ready?: boolean
      maintenance_type?: string
      maintenance_title?: string
      maintenance_location?: string
      maintenance_severity?: string
      maintenance_description?: string
      needs_photo?: boolean
      ticket_resolved?: boolean
      confirmed_emergency?: boolean
    }
  }

  return {
    intent: raw.intent,
    responseText: raw.response_text,
    actionData: {
      ticketReady: raw.action_data?.ticket_ready,
      maintenanceType: raw.action_data?.maintenance_type,
      maintenanceTitle: raw.action_data?.maintenance_title,
      maintenanceLocation: raw.action_data?.maintenance_location,
      maintenanceSeverity: raw.action_data?.maintenance_severity,
      maintenanceDescription: raw.action_data?.maintenance_description,
      needsPhoto: raw.action_data?.needs_photo,
      ticketResolved: raw.action_data?.ticket_resolved,
      confirmedEmergency: raw.action_data?.confirmed_emergency,
    },
  }
}
