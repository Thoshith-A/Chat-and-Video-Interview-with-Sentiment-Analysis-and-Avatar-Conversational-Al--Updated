/** Run: npx tsx server/services/autopilotAgent.test.ts */
import { buildAutopilotPrompt, normalizeDecision } from './autopilotAgent'
import type { AgentContext } from '../../shared/autopilot'

let failures = 0
function assert(label: string, cond: boolean) { console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}`); if (!cond) failures++ }

const ctx: AgentContext = {
  route: '/sessions/new',
  availableActions: [
    { name: 'setup.selectMode', description: 'Select mode', screen: 'setup', sideEffect: false,
      params: [{ name: 'mode', type: 'enum', enum: ['chatbot', 'voice'], required: true }] },
    { name: 'setup.createInvites', description: 'Create + send invites', screen: 'setup', sideEffect: true, params: [] },
  ],
  state: { step: 1, mode: '', role: '' },
}
const prompt = buildAutopilotPrompt(ctx)
assert('prompt lists action names', prompt.includes('setup.selectMode') && prompt.includes('setup.createInvites'))
assert('prompt marks side-effect', /createInvites[\s\S]*side.?effect/i.test(prompt) || prompt.includes('sideEffect'))
assert('prompt includes current route', prompt.includes('/sessions/new'))
assert('prompt states TalbotIQ-only scope', /TalbotIQ/.test(prompt))
assert('prompt nudges one-shot extraction', /extract .*(all|every)|already (told|gave|provided|mentioned)/i.test(prompt))

const names = ctx.availableActions.map((a) => a.name)
// unknown action name is dropped
const d1 = normalizeDecision({ say: 'ok', actionName: 'setup.hackTheDb', argsJson: '{}', awaitingUser: false }, names)
assert('unknown action dropped', d1.action === undefined)
assert('unknown action forces awaitingUser (no stall)', d1.awaitingUser === true)
// known action + args parsed
const d2 = normalizeDecision({ say: 'Selecting voice', actionName: 'setup.selectMode', argsJson: '{"mode":"voice"}', awaitingUser: false }, names)
assert('known action kept', d2.action?.name === 'setup.selectMode' && (d2.action?.args as any).mode === 'voice')
// bad argsJson → empty args, action still named
const d3 = normalizeDecision({ say: 'x', actionName: 'setup.selectMode', argsJson: 'not json', awaitingUser: false }, names)
assert('bad argsJson → empty args', d3.action?.name === 'setup.selectMode' && Object.keys(d3.action?.args ?? {}).length === 0)
// empty actionName → no action
const d4 = normalizeDecision({ say: 'What role?', actionName: '', argsJson: '', awaitingUser: true }, names)
assert('empty actionName → no action, awaiting', d4.action === undefined && d4.awaitingUser === true)

console.log(`\n${failures === 0 ? '✅ ALL AUTOPILOT-AGENT TESTS PASSED' : `❌ ${failures} FAILED`}`)
process.exit(failures === 0 ? 0 : 1)
