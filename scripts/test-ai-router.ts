/**
 * AI Router test harness.
 *
 * Runs a suite of synthetic tenant messages through runAiRouter() and writes
 * the full results to scripts/ai-router-results.json.
 *
 * Usage (from the tenant-response directory):
 *   npx tsx scripts/test-ai-router.ts
 *
 * Requires DEEPSEEK_KEY and DEEPSEEK_MODEL to be set. The script reads
 * .env.local automatically if present.
 */

// Env vars are loaded by scripts/load-env.cjs via --require before this file runs.
// Run with: npx tsx --require ./scripts/load-env.cjs scripts/test-ai-router.ts
// (or just: npm run test:ai)

import { writeFileSync } from 'fs'
import { join } from 'path'
import { runAiRouter } from '../lib/ai/router'
import type { RouterOutput } from '../lib/ai/router'

// ─── Types ────────────────────────────────────────────────────────────────────

type HistoryMessage = {
  direction: 'inbound' | 'outbound'
  body: string
  sender_type: string
}

type RouterInput = {
  clientName: string
  aiConfig: { business_hours?: unknown; rent_policy?: string }
  history: HistoryMessage[]
  inboundBody: string
  hasMedia: boolean
}

type Intent = 'maintenance' | 'emergency' | 'late_rent' | 'general'

type TestCase = {
  id: string
  description: string
  expectedIntent: Intent
  notes?: string
  input: RouterInput
}

type TestResult = {
  id: string
  description: string
  expectedIntent: Intent
  notes?: string
  durationMs: number
  output: RouterOutput | null
  intentMatch: boolean
  error: string | null
}

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const CLIENT_NAME = 'Sunset Properties'
const RENT_POLICY =
  'Rent is due on the 1st of each month. A 5-day grace period applies. After the grace period a $75 late fee is charged. Repeated late payments may result in lease non-renewal.'

const BASE: Pick<RouterInput, 'clientName' | 'aiConfig'> = {
  clientName: CLIENT_NAME,
  aiConfig: { rent_policy: RENT_POLICY },
}

const NO_HISTORY: HistoryMessage[] = []

// Helper to build AI-asks-for-severity history for mid-conversation tests
function maintenanceGatheringHistory(
  firstTenantMsg: string,
  aiFirstReply: string,
  secondTenantMsg: string,
  aiSecondReply: string,
): HistoryMessage[] {
  return [
    { direction: 'inbound', body: firstTenantMsg, sender_type: 'human' },
    { direction: 'outbound', body: aiFirstReply, sender_type: 'ai' },
    { direction: 'inbound', body: secondTenantMsg, sender_type: 'human' },
    { direction: 'outbound', body: aiSecondReply, sender_type: 'ai' },
  ]
}

// ─── Test cases ───────────────────────────────────────────────────────────────

const TEST_CASES: TestCase[] = [

  // ── General ──────────────────────────────────────────────────────────────────

  {
    id: 'general-greeting',
    description: 'Plain "Hey" — no request, no context',
    expectedIntent: 'general',
    input: { ...BASE, history: NO_HISTORY, inboundBody: 'Hey', hasMedia: false },
  },
  {
    id: 'general-office-hours-question',
    description: 'Question about office hours (not in config)',
    expectedIntent: 'general',
    notes: 'Should say team will follow up; must NOT invent hours',
    input: { ...BASE, history: NO_HISTORY, inboundBody: 'What time does the office open?', hasMedia: false },
  },
  {
    id: 'general-thank-you',
    description: 'Simple thank-you — conversation closer',
    expectedIntent: 'general',
    input: { ...BASE, history: NO_HISTORY, inboundBody: 'Thanks, got it!', hasMedia: false },
  },
  {
    id: 'general-subletting-question',
    description: 'Subletting question — out of scope; AI has no lease data',
    expectedIntent: 'general',
    notes: 'Must NOT invent lease terms; must say team will follow up',
    input: { ...BASE, history: NO_HISTORY, inboundBody: 'Am I allowed to sublet my apartment to someone?', hasMedia: false },
  },
  {
    id: 'general-rent-amount-inquiry',
    description: 'Tenant asks how much rent they owe — no dollar amounts in config',
    expectedIntent: 'general',
    notes: 'Must NOT invent a dollar amount',
    input: { ...BASE, history: NO_HISTORY, inboundBody: 'How much is my rent per month?', hasMedia: false },
  },
  {
    id: 'general-am-i-talking-to-ai',
    description: 'Tenant directly asks if they are talking to a robot',
    expectedIntent: 'general',
    notes: 'Prompt says never mention AI unless directly asked — this IS a direct ask',
    input: { ...BASE, history: NO_HISTORY, inboundBody: 'Wait, am I talking to a real person or a robot?', hasMedia: false },
  },
  {
    id: 'general-spanish-message',
    description: 'Spanish-language message ("I need help with my apartment")',
    expectedIntent: 'general',
    notes: 'Should handle gracefully — ideally responds in Spanish or asks for English',
    input: { ...BASE, history: NO_HISTORY, inboundBody: 'Hola, necesito ayuda con mi apartamento.', hasMedia: false },
  },
  {
    id: 'general-gibberish',
    description: 'Random characters — unrecognizable input',
    expectedIntent: 'general',
    notes: 'Should not crash; should ask tenant to clarify',
    input: { ...BASE, history: NO_HISTORY, inboundBody: 'asdfgh jkl qwerty 123 !!!', hasMedia: false },
  },

  // ── Maintenance — first turn ──────────────────────────────────────────────────

  {
    id: 'maintenance-vague-first-message',
    description: 'Vague maintenance report — only says "my sink is leaking"',
    expectedIntent: 'maintenance',
    notes: 'ticket_ready must be FALSE; AI should ask for type, location, AND severity',
    input: { ...BASE, history: NO_HISTORY, inboundBody: 'My sink is leaking.', hasMedia: false },
  },
  {
    id: 'maintenance-type-and-location-no-severity',
    description: 'Has type (plumbing) and location (kitchen) but no severity',
    expectedIntent: 'maintenance',
    notes: 'ticket_ready must be FALSE',
    input: { ...BASE, history: NO_HISTORY, inboundBody: "There's a plumbing issue in my kitchen.", hasMedia: false },
  },
  {
    id: 'maintenance-all-three-fields-upfront',
    description: 'All three fields in first message — severe plumbing in kitchen',
    expectedIntent: 'maintenance',
    notes: 'ticket_ready SHOULD be TRUE; AI should ask for photo (needs_photo=true)',
    input: {
      ...BASE,
      history: NO_HISTORY,
      inboundBody: "There's a severe plumbing leak under my kitchen sink, water is everywhere.",
      hasMedia: false,
    },
  },
  {
    id: 'maintenance-pest-control',
    description: 'Pest issue — cockroaches in bathroom and kitchen',
    expectedIntent: 'maintenance',
    input: { ...BASE, history: NO_HISTORY, inboundBody: 'I found cockroaches in my bathroom and kitchen.', hasMedia: false },
  },
  {
    id: 'maintenance-hvac-cold-not-freezing',
    description: 'Heat not working but tenant says it is manageable — NOT an emergency',
    expectedIntent: 'maintenance',
    notes: 'Should be maintenance, NOT emergency',
    input: {
      ...BASE,
      history: NO_HISTORY,
      inboundBody: "The heat in my unit isn't working great. It's a bit cold but I'm managing.",
      hasMedia: false,
    },
  },
  {
    id: 'maintenance-electrical-flickering-light',
    description: 'Electrical issue — flickering light in bedroom',
    expectedIntent: 'maintenance',
    input: { ...BASE, history: NO_HISTORY, inboundBody: 'The light in my bedroom keeps flickering.', hasMedia: false },
  },
  {
    id: 'maintenance-appliance-fridge-broken',
    description: 'Appliance failure — refrigerator stopped working',
    expectedIntent: 'maintenance',
    input: { ...BASE, history: NO_HISTORY, inboundBody: 'My refrigerator stopped working, all my food is spoiling.', hasMedia: false },
  },

  // ── Maintenance — multi-turn ──────────────────────────────────────────────────

  {
    id: 'maintenance-mid-provides-severity',
    description: 'Mid-conversation: AI asked for severity, tenant now provides it → all 3 fields present',
    expectedIntent: 'maintenance',
    notes: 'ticket_ready SHOULD be TRUE now; maintenanceType=plumbing, maintenanceLocation=kitchen, maintenanceSeverity=moderate',
    input: {
      ...BASE,
      history: maintenanceGatheringHistory(
        'My kitchen sink is leaking.',
        "Got it! To help you, could you tell me: (1) Type — plumbing, electrical, HVAC, appliance, gas, pest, or other? (2) Which room? (3) Severity — mild, moderate, or severe?",
        "It's plumbing, in the kitchen.",
        "Thanks! And how severe is the leak — mild, moderate, or severe?",
      ),
      inboundBody: "I'd say moderate.",
      hasMedia: false,
    },
  },
  {
    id: 'maintenance-mid-photo-sent',
    description: 'Mid-conversation: AI asked for photo after ticket_ready, tenant sends MMS',
    expectedIntent: 'maintenance',
    notes: 'Should confirm ticket created and acknowledge photo receipt',
    input: {
      ...BASE,
      history: [
        { direction: 'inbound', body: "There's a severe plumbing leak under my kitchen sink.", sender_type: 'human' },
        { direction: 'outbound', body: "Got it — severe plumbing in the kitchen. Your ticket is being created. Could you send a photo of the damage?", sender_type: 'ai' },
      ],
      inboundBody: 'Here you go',
      hasMedia: true,
    },
  },
  {
    id: 'maintenance-mid-photo-declined',
    description: "Mid-conversation: AI asked for photo, tenant can't take one",
    expectedIntent: 'maintenance',
    notes: 'Should confirm ticket created without requiring a photo',
    input: {
      ...BASE,
      history: [
        { direction: 'inbound', body: "There's a severe plumbing leak under my kitchen sink.", sender_type: 'human' },
        { direction: 'outbound', body: "Got it — severe plumbing in the kitchen. Your ticket is being created. Could you send a photo of the damage?", sender_type: 'ai' },
      ],
      inboundBody: "I don't have a way to take a photo right now.",
      hasMedia: false,
    },
  },
  {
    id: 'maintenance-mid-follow-up-question',
    description: 'Mid-conversation: tenant asks a follow-up question after ticket submitted',
    expectedIntent: 'general',
    notes: 'Ticket is already done; this is a general follow-up — should not re-open maintenance flow',
    input: {
      ...BASE,
      history: [
        { direction: 'inbound', body: "Severe plumbing leak in my kitchen sink.", sender_type: 'human' },
        { direction: 'outbound', body: "Your maintenance ticket has been created — plumbing, kitchen, severe. Our team will reach out shortly.", sender_type: 'ai' },
      ],
      inboundBody: "How long does it usually take for someone to come?",
      hasMedia: false,
    },
  },

  // ── Emergency ─────────────────────────────────────────────────────────────────

  {
    id: 'emergency-gas-leak',
    description: 'Gas leak — strong smell in apartment',
    expectedIntent: 'emergency',
    notes: 'confirmed_emergency MUST be TRUE; response must be urgent',
    input: { ...BASE, history: NO_HISTORY, inboundBody: "I smell gas in my apartment, it's really strong.", hasMedia: false },
  },
  {
    id: 'emergency-fire-smoke',
    description: 'Smoke coming from wall socket — potential electrical fire',
    expectedIntent: 'emergency',
    notes: 'confirmed_emergency MUST be TRUE',
    input: { ...BASE, history: NO_HISTORY, inboundBody: "There's smoke coming out of my wall socket.", hasMedia: false },
  },
  {
    id: 'emergency-active-flooding',
    description: 'Burst pipe — water flooding everywhere',
    expectedIntent: 'emergency',
    notes: 'confirmed_emergency MUST be TRUE',
    input: { ...BASE, history: NO_HISTORY, inboundBody: "My bathroom pipe burst and water is flooding everywhere.", hasMedia: false },
  },
  {
    id: 'emergency-no-heat-freezing',
    description: 'No heat and below-freezing temperatures for 2 days',
    expectedIntent: 'emergency',
    notes: 'confirmed_emergency MUST be TRUE per prompt (no heat below freezing)',
    input: {
      ...BASE,
      history: NO_HISTORY,
      inboundBody: "My heat has been out for 2 days and it's below freezing in here, I can see my breath.",
      hasMedia: false,
    },
  },
  {
    id: 'emergency-break-in',
    description: 'Tenant reports a break-in',
    expectedIntent: 'emergency',
    notes: 'confirmed_emergency MUST be TRUE',
    input: { ...BASE, history: NO_HISTORY, inboundBody: "Someone broke into my apartment through the back door.", hasMedia: false },
  },
  {
    id: 'emergency-medical',
    description: 'Roommate collapsed — medical emergency',
    expectedIntent: 'emergency',
    notes: 'confirmed_emergency MUST be TRUE',
    input: { ...BASE, history: NO_HISTORY, inboundBody: "My roommate collapsed and is not responding, I need help.", hasMedia: false },
  },
  {
    id: 'emergency-ceiling-collapse',
    description: 'Structural — part of ceiling physically fell in',
    expectedIntent: 'emergency',
    notes: 'confirmed_emergency MUST be TRUE',
    input: { ...BASE, history: NO_HISTORY, inboundBody: "Part of my ceiling just collapsed into my living room.", hasMedia: false },
  },

  // ── Late Rent ─────────────────────────────────────────────────────────────────

  {
    id: 'late-rent-simple-notice',
    description: 'Straightforward notice: tenant will be late',
    expectedIntent: 'late_rent',
    notes: 'Must acknowledge AND share full rent policy including the $75 fee',
    input: { ...BASE, history: NO_HISTORY, inboundBody: "I won't be able to pay my rent on time this month.", hasMedia: false },
  },
  {
    id: 'late-rent-partial-payment',
    description: 'Tenant can only pay half, rest in 2 weeks',
    expectedIntent: 'late_rent',
    notes: 'Should NOT invent a payment plan not in the policy',
    input: {
      ...BASE,
      history: NO_HISTORY,
      inboundBody: "I can only pay half of my rent right now and will pay the rest in 2 weeks.",
      hasMedia: false,
    },
  },
  {
    id: 'late-rent-job-loss-hardship',
    description: 'Tenant lost their job and is distressed about not being able to pay',
    expectedIntent: 'late_rent',
    notes: 'Should be empathetic; must NOT invent hardship programs',
    input: {
      ...BASE,
      history: NO_HISTORY,
      inboundBody: "I just lost my job and honestly don't know if I can pay rent this month. I'm really stressed and scared.",
      hasMedia: false,
    },
  },
  {
    id: 'late-rent-policy-question',
    description: 'Proactive question about late fees before being late',
    expectedIntent: 'late_rent',
    notes: 'Should surface the $75 fee and 5-day grace period from config',
    input: { ...BASE, history: NO_HISTORY, inboundBody: "What happens if I pay my rent a few days late?", hasMedia: false },
  },
  {
    id: 'late-rent-no-policy-configured',
    description: 'Late rent message when NO rent_policy is set on the client',
    expectedIntent: 'late_rent',
    notes: 'Must fall back to "contact office" default; must NOT invent a policy',
    input: {
      clientName: CLIENT_NAME,
      aiConfig: {}, // intentionally empty — no rent_policy
      history: NO_HISTORY,
      inboundBody: "I'm going to be late on rent this month.",
      hasMedia: false,
    },
  },

  // ── Ambiguous / Edge Cases ───────────────────────────────────────────────────

  {
    id: 'ambiguous-ceiling-cracking',
    description: 'Ceiling cracking — could go maintenance or emergency',
    expectedIntent: 'emergency',
    notes: 'Structural danger; emergency is the safer classification',
    input: {
      ...BASE,
      history: NO_HISTORY,
      inboundBody: "There are huge cracks in my ceiling and I think it might fall in.",
      hasMedia: false,
    },
  },
  {
    id: 'ambiguous-multi-intent',
    description: 'One message contains both a maintenance issue and a late rent notice',
    expectedIntent: 'maintenance',
    notes: 'AI can only pick one intent — curious which it prioritizes and how it handles the other topic',
    input: {
      ...BASE,
      history: NO_HISTORY,
      inboundBody: "Hey, the sink in my bathroom is broken, and also I think I might be late on rent this month.",
      hasMedia: false,
    },
  },
  {
    id: 'ambiguous-angry-maintenance',
    description: 'Tenant is furious about a 3-week unresolved AC issue',
    expectedIntent: 'maintenance',
    notes: 'Hostile tone but underlying need is maintenance; AI should stay professional and not escalate',
    input: {
      ...BASE,
      history: NO_HISTORY,
      inboundBody: "This is ABSOLUTELY RIDICULOUS. The AC has been broken for 3 WEEKS and no one has come to fix it. I am FURIOUS. FIX IT NOW.",
      hasMedia: false,
    },
  },
  {
    id: 'ambiguous-borderline-no-heat',
    description: 'No heat — cold but explicitly not freezing (borderline maintenance vs emergency)',
    expectedIntent: 'maintenance',
    notes: 'Should stay maintenance since tenant says they are okay',
    input: {
      ...BASE,
      history: NO_HISTORY,
      inboundBody: "The heat in my unit isn't working. It's a bit cold in here but I'm okay.",
      hasMedia: false,
    },
  },
  {
    id: 'edge-photo-with-no-body',
    description: 'Unsolicited MMS photo with completely empty message body',
    expectedIntent: 'general',
    notes: 'hasMedia=true, body="" — AI should ask what the photo is about',
    input: { ...BASE, history: NO_HISTORY, inboundBody: '', hasMedia: true },
  },
  {
    id: 'edge-very-long-detailed-message',
    description: 'Long, detailed maintenance message with all info embedded in prose',
    expectedIntent: 'maintenance',
    notes: 'ticket_ready SHOULD be TRUE — type, location, and severity are all stated',
    input: {
      ...BASE,
      history: NO_HISTORY,
      inboundBody:
        "Hi, I wanted to reach out about a serious problem I've been dealing with in my apartment. The bathroom faucet has been leaking non-stop for weeks and it's getting worse. The leak is coming from the pipe under the sink, not the faucet itself — I tried tightening it myself but that didn't help. Water has started staining the cabinet below and I'm worried about mold. I'd rate the severity as moderate. Unit 4B. I would really appreciate someone coming to look at it as soon as possible. Thank you.",
      hasMedia: false,
    },
  },
]

// ─── Runner ───────────────────────────────────────────────────────────────────

async function runTests(): Promise<void> {
  console.log(`\n🧪 AI Router Test Suite — ${TEST_CASES.length} cases\n`)
  console.log(`   Model: ${process.env.DEEPSEEK_MODEL ?? '(DEEPSEEK_MODEL not set)'}`)
  console.log(`   Client: ${CLIENT_NAME}\n`)
  console.log('─'.repeat(72))

  const results: TestResult[] = []
  let passed = 0
  let failed = 0
  let errored = 0

  for (const tc of TEST_CASES) {
    process.stdout.write(`  ${tc.id.padEnd(44)} `)

    const start = Date.now()
    let output: RouterOutput | null = null
    let error: string | null = null

    try {
      output = await runAiRouter(tc.input as Parameters<typeof runAiRouter>[0])
    } catch (err) {
      error = err instanceof Error ? err.message : String(err)
    }

    const durationMs = Date.now() - start
    const intentMatch = output?.intent === tc.expectedIntent
    const status = error ? '  ERROR' : intentMatch ? '  ✓' : '  ✗'

    if (error) errored++
    else if (intentMatch) passed++
    else failed++

    const marker = error ? '🔴' : intentMatch ? '🟢' : '🟡'
    const intentLabel = output ? `[${output.intent}]` : '[no output]'
    console.log(`${marker}  ${status.padEnd(8)} ${intentLabel.padEnd(16)} ${durationMs}ms`)

    results.push({
      id: tc.id,
      description: tc.description,
      expectedIntent: tc.expectedIntent,
      notes: tc.notes,
      durationMs,
      output,
      intentMatch: intentMatch && !error,
      error,
    })
  }

  console.log('─'.repeat(72))
  console.log(`\n  Results: ${passed} passed  ${failed} wrong intent  ${errored} errors  (${TEST_CASES.length} total)\n`)

  // ── Write JSON results ──────────────────────────────────────────────────────

  const report = {
    runAt: new Date().toISOString(),
    model: process.env.DEEPSEEK_MODEL ?? null,
    clientName: CLIENT_NAME,
    summary: { total: TEST_CASES.length, passed, wrongIntent: failed, errors: errored },
    results,
  }

  const outPath = join(process.cwd(), 'scripts', 'ai-router-results.json')
  writeFileSync(outPath, JSON.stringify(report, null, 2), 'utf8')
  console.log(`  Results written to scripts/ai-router-results.json\n`)
}

runTests().catch((err) => {
  console.error('Fatal error running test suite:', err)
  process.exit(1)
})
