/**
 * The `video` track reuses the timed per-question engine (like `chat`) and the
 * per-question (non-conversational) scoring branch. Run with:
 *   npx tsx server/services/videoTrack.test.ts
 */
import { tick } from './timing'
import { heuristicReport } from './scoring'
import { DEFAULT_TIMING, DEFAULT_INTEGRITY, DEFAULT_BRANDING, defaultRubric } from '../store/defaults'
import type { InterviewSession, InterviewTemplate } from '../../shared/types'

let failures = 0
function assert(label: string, cond: boolean, extra = '') {
  console.log(`  ${cond ? 'PASS' : 'FAIL'}  ${label}${extra ? ' — ' + extra : ''}`)
  if (!cond) failures++
}

function makeTemplate(): InterviewTemplate {
  return {
    id: 't1', name: 'Video', role: 'Engineer', track: 'video', questionSource: 'fixed',
    timing: { ...DEFAULT_TIMING }, rubric: defaultRubric(),
    integrity: { ...DEFAULT_INTEGRITY }, branding: { ...DEFAULT_BRANDING },
    createdAt: 'now', updatedAt: 'now',
  }
}
function makeSession(startMsAgo: number): InterviewSession {
  const started = new Date(Date.now() - startMsAgo).toISOString()
  return {
    id: 's1', templateId: 't1', track: 'video',
    candidate: { name: 'A', email: 'a@x.com' }, status: 'in_progress',
    questions: [{ id: 'q1', text: 'Q1', autoSubmitted: false, prepStartedAt: started }],
    currentIndex: 0, createdAt: started, startedAt: started, integrityEvents: [], tabSwitchCount: 0,
  }
}

console.log('\n=== video track: timed engine applies ===')
{
  // prep started 31s ago (> 30s prep) → tick should open the answer phase.
  const s = makeSession(31_000)
  const changed = tick(s, makeTemplate())
  assert('tick mutates a video session (NOT exempt like chatbot/avatar)', changed === true)
  assert('answer phase opened after prep elapsed', Boolean(s.questions[0].answerStartedAt))
}

console.log('\n=== video track: per-question scoring shape ===')
{
  const s = makeSession(0)
  s.questions[0].answerText = 'I built distributed systems for six years handling high load.'
  s.questions[0].submittedAt = new Date().toISOString()
  s.status = 'completed'
  const report = heuristicReport(s, makeTemplate())
  assert('scored per-question by questionId (not q0 transcript group)', report.perQuestion[0].questionId === 'q1')
  assert('overall score is computed', typeof report.overallScore === 'number')
}

console.log(`\n${failures === 0 ? '✅ ALL VIDEO-TRACK TESTS PASSED' : `❌ ${failures} ASSERTION(S) FAILED`}`)
process.exit(failures === 0 ? 0 : 1)
