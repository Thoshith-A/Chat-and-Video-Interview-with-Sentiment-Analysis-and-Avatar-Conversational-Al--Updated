/**
 * Pipeline route ownership + rounds-validation. Run with:
 *   npx tsx server/routes/pipelines.test.ts
 * Exercises exported helpers directly (no HTTP harness / Firestore).
 */
import { db } from '../store/db'
import { __test } from './pipelines'
import type { AuthContext, RoundDef } from '../../shared/types'

const { owns, normalize, loadOwned } = __test
let failures = 0
function assert(label: string, cond: boolean, extra = '') {
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? ' — ' + extra : ''}`)
  if (!cond) failures++
}
function throws(label: string, fn: () => void, statusWanted?: number) {
  try { fn(); assert(label, false, 'expected throw') }
  catch (e: any) { assert(label, statusWanted ? e?.status === statusWanted : true, `status=${e?.status}`) }
}
const alice: AuthContext = { uid: 'alice', email: 'a@x.com', emailVerified: true, role: 'recruiter', admin: false }
const bob: AuthContext = { uid: 'bob', email: 'b@x.com', emailVerified: true, role: 'recruiter', admin: false }

const goodRounds: RoundDef[] = [
  { index: 0, name: 'Screening', mode: 'chatbot', source: 'tailor',
    config: { style: 'mix', techCount: 3, nonTechCount: 2, difficulty: 'mixed', domains: [], model: 'gemini-2.5-flash' } },
  { index: 1, name: 'Technical', mode: 'video', advanceRule: { kind: 'threshold', value: 60 } },
]

// normalize: valid
const n = normalize({ role: 'Backend', rounds: goodRounds })
assert('type forced multi', n.type === 'multi')
assert('role kept', n.role === 'Backend')
assert('rounds count', n.rounds.length === 2)
assert('advanceRule kept', n.rounds[1].advanceRule?.value === 60)

// normalize: reindex non-contiguous
const nr = normalize({ role: 'R', rounds: [{ index: 5, name: 'A', mode: 'chat' }, { index: 9, name: 'B', mode: 'voice' }] })
assert('reindexed 0..n', nr.rounds[0].index === 0 && nr.rounds[1].index === 1)

// normalize: reject empty rounds
throws('empty rounds -> 400', () => normalize({ role: 'R', rounds: [] }), 400)
// normalize: reject disallowed mode (two_way)
throws('two_way mode -> 400', () => normalize({ role: 'R', rounds: [{ index: 0, name: 'X', mode: 'two_way' }] }), 400)
// normalize: reject round without name
throws('missing name -> 400', () => normalize({ role: 'R', rounds: [{ index: 0, name: '', mode: 'chat' }] }), 400)
// normalize: reject missing role
throws('missing role -> 400', () => normalize({ role: '', rounds: goodRounds }), 400)

// owns / loadOwned
const now = '2026-07-22T00:00:00.000Z'
db.pipelines.set('pl-a', { id: 'pl-a', recruiterId: 'alice', role: 'R', type: 'multi', rounds: goodRounds, createdAt: now, updatedAt: now })
assert('owner owns', owns(db.pipelines.get('pl-a')!, alice))
assert('non-owner does not', !owns(db.pipelines.get('pl-a')!, bob))
assert('loadOwned returns for owner', loadOwned('pl-a', alice).id === 'pl-a')
throws('loadOwned 404 cross-owner', () => loadOwned('pl-a', bob), 404)
throws('loadOwned 404 missing', () => loadOwned('nope', alice), 404)
db.pipelines.delete('pl-a')

console.log(`\n${failures === 0 ? '✅ ALL PIPELINE-ROUTE TESTS PASSED' : `❌ ${failures} ASSERTION(S) FAILED`}`)
process.exit(failures === 0 ? 0 : 1)
