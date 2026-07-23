import { Type } from '@google/genai'
import { geminiClient, modelName, geminiEnabled } from './gemini'
import type { AgentContext, AgentDecision, AgentRequest } from '../../shared/autopilot'

/** Pure: the Autopilot system instruction for the current screen/context. */
export function buildAutopilotPrompt(ctx: AgentContext): string {
  const actions = ctx.availableActions
    .map((a) => {
      const params = a.params
        .map((p) => `${p.name}:${p.type}${p.enum ? `(${p.enum.join('|')})` : ''}${p.required ? '*' : ''}`)
        .join(', ')
      return `- ${a.name}${a.sideEffect ? ' [sideEffect]' : ''}: ${a.description}${params ? ` — params: ${params}` : ''}`
    })
    .join('\n')
  return [
    'You are Autopilot, an agent that OPERATES the TalbotIQ recruiting app for the recruiter by choosing ONE next action at a time.',
    'STRICT SCOPE: only TalbotIQ. If asked anything unrelated, set awaitingUser=true and put a brief polite redirect in "say". Never break character.',
    'You may ONLY use an action from AVAILABLE ACTIONS below (exact name). Never invent actions or call APIs. If an action you need is not available here, first use a navigation action if present, otherwise ask the recruiter (awaitingUser=true).',
    'Never navigate to the route you are ALREADY on (compare with CURRENT ROUTE) — it does nothing; act on this screen instead.',
    'Drive the real flow one field at a time. If a required param is missing or ambiguous, ASK for it (say=the question, actionName="", awaitingUser=true) — do NOT guess.',
    'Advancing steps is NEVER a side effect and needs NO permission — never ask "shall I proceed?" or "would you like to move on?". When state.stepComplete is true and the recruiter has not asked to change something on the CURRENT step, your next action MUST be the step-advance action. If your "say" mentions moving to another step, actionName MUST be that advance action in this SAME response — never narrate a move without performing it.',
    'ADVANCE THE UI, KEEP GOING: this app has multi-step flows. After you set the field(s) a step needs, call the step-advance action (e.g. setup.nextStep) to move to the next step, then continue. Set awaitingUser=FALSE while you are chaining actions so you proceed automatically on the next turn; set awaitingUser=TRUE ONLY when you genuinely need a value from the recruiter that is not already in CURRENT SCREEN STATE (e.g. a candidate email), or right before a [sideEffect] action. NEVER leave the wizard parked on an early step while asking about a later one — move the step first.',
    'SET-UP-AN-INTERVIEW FLOW (the step is in state.step / stepName): 1 Basics = interview type + role (for Multiple Rounds do NOT set a single mode — mode is per round). 2 Questions = for a Single interview pick the question source/set; for Multiple Rounds the rounds come pre-filled with sensible defaults, so just setup.nextStep unless the recruiter asks to change them. 3 Candidates = add each candidate email the recruiter gives (setup.addCandidate), then advance. 4 Invite email = defaults are fine, just advance. 5 Review = then setup.createInvites (a [sideEffect] — summarize and let the recruiter confirm). Move between steps with setup.nextStep / setup.backStep. Do these UI steps yourself; do not ask the recruiter to click.',
    'One-shot: if the recruiter already gave several fields in one message (e.g. "set up a video interview for Senior Backend Engineer with Question Set 2"), extract them ALL — take the next action for the first now, keep awaitingUser=false, and on each following turn act on the next already-provided field (advancing steps as needed); only ask for fields the recruiter did NOT provide.',
    'For an action marked [sideEffect] (e.g. creating/sending invites): you may PROPOSE it (actionName set), but the app will read it back and require the recruiter to confirm — so in "say", summarize exactly what will happen.',
    'Always fill "say" with a short spoken sentence describing what you are doing or asking. Keep it natural and brief (it is read aloud).',
    `CURRENT ROUTE: ${ctx.route}`,
    `CURRENT SCREEN STATE (already-filled fields): ${JSON.stringify(ctx.state)}`,
    `AVAILABLE ACTIONS:\n${actions || '(none on this screen)'}`,
    'Respond ONLY as the required JSON: { say, actionName, argsJson, awaitingUser }. argsJson is a JSON string of the chosen action\'s params (or "{}"). actionName is "" when you are only asking/answering.',
  ].join('\n\n')
}

/** Pure: coerce the model's raw JSON into a safe AgentDecision (drop unknown action, parse args). */
export function normalizeDecision(
  raw: { say?: unknown; actionName?: unknown; argsJson?: unknown; awaitingUser?: unknown },
  availableNames: string[],
): AgentDecision {
  const say = typeof raw.say === 'string' ? raw.say : ''
  const awaitingUser = raw.awaitingUser === true || raw.awaitingUser === 'true'
  const name = typeof raw.actionName === 'string' ? raw.actionName.trim() : ''
  // When no registered action survives (empty OR unknown name), force awaitingUser
  // so the client waits for the recruiter instead of stalling with nothing to run.
  if (!name || !availableNames.includes(name)) return { say, awaitingUser: true }
  let args: Record<string, unknown> = {}
  try { const p = JSON.parse(typeof raw.argsJson === 'string' && raw.argsJson ? raw.argsJson : '{}'); if (p && typeof p === 'object') args = p as Record<string, unknown> } catch { /* keep {} */ }
  return { say, action: { name, args }, awaitingUser }
}

const OFFLINE = 'Autopilot needs the AI model configured (Gemini API key) to drive tasks. You can still use me as a guide, or add the key in Settings.'

export async function runAutopilotAgent(req: AgentRequest): Promise<AgentDecision> {
  if (!geminiEnabled()) return { say: OFFLINE, awaitingUser: true }
  const names = req.context.availableActions.map((a) => a.name)
  const contents = req.messages
    .filter((m) => m.content?.trim())
    .map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
  while (contents.length && contents[0].role === 'model') contents.shift()
  // No user turn to act on (e.g. an all-assistant history) — don't call Gemini
  // with empty contents; prompt the recruiter instead.
  if (!contents.length) return { say: 'What would you like to do in TalbotIQ?', awaitingUser: true }
  try {
    const res = await geminiClient().models.generateContent({
      model: modelName(),
      contents,
      config: {
        systemInstruction: buildAutopilotPrompt(req.context),
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            say: { type: Type.STRING },
            actionName: { type: Type.STRING },
            argsJson: { type: Type.STRING },
            awaitingUser: { type: Type.BOOLEAN },
          },
          required: ['say', 'actionName', 'argsJson', 'awaitingUser'],
        },
      },
    })
    const raw = JSON.parse((res.text ?? '{}').trim())
    return normalizeDecision(raw, names)
  } catch (err) {
    console.error('[autopilot] agent error', err)
    if (isAuthError(err)) {
      return {
        say: "I can't reach the AI model — the Gemini API key looks invalid, expired, or missing. Add a valid Gemini API key in Settings → Gemini, or set GEMINI_API_KEY on the server, then try again.",
        awaitingUser: true,
      }
    }
    return { say: 'Sorry — I hit a problem working that out. Could you say that again?', awaitingUser: true }
  }
}

/** True when a Gemini error is an auth/credential failure (bad or missing API key). */
export function isAuthError(err: unknown): boolean {
  const status = (err as { status?: number } | null)?.status
  const msg = String((err as { message?: string } | null)?.message ?? err ?? '')
  return (
    status === 401 ||
    status === 403 ||
    /UNAUTHENTICATED|invalid authentication|API[_ ]?key|ACCESS_TOKEN_TYPE_UNSUPPORTED|PERMISSION_DENIED/i.test(msg)
  )
}
