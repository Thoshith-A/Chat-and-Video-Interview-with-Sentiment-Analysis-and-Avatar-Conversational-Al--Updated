/**
 * Multi-round pipelines — owned per recruiter, mirroring the inviteEmailTemplates
 * isolation pattern (recruiterId server-stamped, owner-filtered list, 404-no-leak).
 * Storage is the in-memory Express/JSON store (server/store/db.ts). Additive: does
 * not touch sessions/invites/auth. Round-1 invites are created via the shared
 * interviewInvite service.
 */
import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import { db } from '../store/db'
import { ah, HttpError } from '../util/ah'
import { requireAuth } from '../middleware/auth'
import { createAndSendInterview, type SendCtx } from '../services/interviewInvite'
import { defaultTemplateFor } from '../../shared/inviteEmail'
import type {
  AuthContext, Pipeline, RoundDef, TrackType,
  PipelineCandidate, PipelineInviteResult, InviteEmailTemplate,
} from '../../shared/types'

export const pipelinesRouter = Router()

const ALLOWED_ROUND_MODES: TrackType[] = ['chatbot', 'voice', 'video_avatar', 'chat', 'video']

const owns = (p: Pipeline, auth: AuthContext) => auth.admin || p.recruiterId === auth.uid

function loadOwned(id: string, auth: AuthContext): Pipeline {
  const p = db.pipelines.get(id)
  if (!p || !owns(p, auth)) throw new HttpError(404, 'Pipeline not found')
  return p
}

/** Validate + coerce one round. Throws HttpError(400) on invalid input. */
function normalizeRound(raw: unknown, index: number): RoundDef {
  const r = (raw ?? {}) as Record<string, any>
  const name = typeof r.name === 'string' ? r.name.trim() : ''
  if (!name) throw new HttpError(400, `Round ${index + 1}: name is required`)
  if (!ALLOWED_ROUND_MODES.includes(r.mode)) {
    throw new HttpError(400, `Round ${index + 1}: mode "${r.mode}" is not allowed (two_way deferred)`)
  }
  const round: RoundDef = { index, name, mode: r.mode }
  if (r.source === 'tailor' || r.source === 'set') round.source = r.source
  if (round.source === 'tailor' && r.config) {
    round.config = {
      style: r.config.style, techCount: Number(r.config.techCount) || 0,
      nonTechCount: Number(r.config.nonTechCount) || 0, difficulty: r.config.difficulty,
      domains: Array.isArray(r.config.domains) ? r.config.domains : [], model: r.config.model,
    }
  }
  if (round.source === 'set' && typeof r.questionSetId === 'string') round.questionSetId = r.questionSetId
  if (r.advanceRule && (r.advanceRule.kind === 'threshold' || r.advanceRule.kind === 'topN')) {
    round.advanceRule = { kind: r.advanceRule.kind, value: Number(r.advanceRule.value) || 0 }
  }
  return round
}

function normalize(body: unknown): Omit<Pipeline, 'id' | 'recruiterId' | 'createdAt' | 'updatedAt'> {
  const b = (body ?? {}) as Record<string, any>
  const role = typeof b.role === 'string' ? b.role.trim() : ''
  if (!role) throw new HttpError(400, 'role is required')
  if (!Array.isArray(b.rounds) || b.rounds.length < 1) throw new HttpError(400, 'at least one round is required')
  const rounds = b.rounds.map((r: unknown, i: number) => normalizeRound(r, i)) // reindexes 0..n
  return { role, type: 'multi', name: typeof b.name === 'string' ? b.name.trim() : undefined, rounds }
}

function buildPipelineCandidate(
  pipeline: Pipeline, recruiterId: string,
  c: { email: string; role: string }, interviewId: string, nowIso: string,
): PipelineCandidate {
  return {
    id: randomUUID(), pipelineId: pipeline.id, recruiterId,
    candidateEmail: c.email, candidateEmailLower: c.email.toLowerCase(),
    role: c.role, currentRoundIndex: 0, status: 'in_round',
    perRound: [{ roundIndex: 0, interviewId, invitedAt: nowIso }],
    history: [{ at: nowIso, byUid: recruiterId, action: 'invited', toRound: 0, basis: 'round-1 invite' }],
    createdAt: nowIso, updatedAt: nowIso,
  }
}

/** Resolve the invite-email template for Round 1: inline config wins, else owned id, else default. */
function resolveEmailTemplate(auth: AuthContext, body: Record<string, any>): InviteEmailTemplate | null {
  const now = new Date().toISOString()
  const stamp = (seed: Partial<InviteEmailTemplate>): InviteEmailTemplate => ({
    id: 'inline', recruiterId: auth.uid, createdAt: now, updatedAt: now,
    ...(defaultTemplateFor('invite') as any), ...seed,
  })
  if (body.emailConfig) return stamp(body.emailConfig)
  if (typeof body.emailTemplateId === 'string') {
    const t = db.inviteEmailTemplates.get(body.emailTemplateId)
    if (t && (auth.admin || t.recruiterId === auth.uid)) return t
    throw new HttpError(404, 'Email template not found')
  }
  return stamp({})
}

pipelinesRouter.get('/', ah((req, res) => {
  const auth = requireAuth(req)
  const role = typeof req.query.role === 'string' ? req.query.role : ''
  let mine = [...db.pipelines.values()].filter((p) => owns(p, auth))
  if (role) mine = mine.filter((p) => p.role === role)
  res.json(mine.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')))
}))

pipelinesRouter.get('/:id', ah((req, res) => {
  res.json(loadOwned(req.params.id, requireAuth(req)))
}))

pipelinesRouter.post('/', ah((req, res) => {
  const auth = requireAuth(req)
  const now = new Date().toISOString()
  const p: Pipeline = { id: randomUUID(), recruiterId: auth.uid, createdAt: now, updatedAt: now, ...normalize(req.body) }
  db.pipelines.set(p.id, p)
  db.scheduleSave()
  res.status(201).json(p)
}))

pipelinesRouter.put('/:id', ah((req, res) => {
  const auth = requireAuth(req)
  const existing = loadOwned(req.params.id, auth)
  const updated: Pipeline = { ...existing, ...normalize(req.body), id: existing.id, recruiterId: existing.recruiterId, createdAt: existing.createdAt, updatedAt: new Date().toISOString() }
  db.pipelines.set(updated.id, updated)
  db.scheduleSave()
  res.json(updated)
}))

pipelinesRouter.delete('/:id', ah((req, res) => {
  const auth = requireAuth(req)
  loadOwned(req.params.id, auth)
  db.pipelines.delete(req.params.id)
  db.scheduleSave()
  res.status(204).end()
}))

pipelinesRouter.post('/:id/invite', ah(async (req, res) => {
  const auth = requireAuth(req)
  const pipeline = loadOwned(req.params.id, auth)
  const body = (req.body ?? {}) as Record<string, any>
  const candidates: { email: string; role: string }[] = Array.isArray(body.candidates) ? body.candidates : []
  if (candidates.length === 0) throw new HttpError(400, 'no candidates')
  const round0: RoundDef = pipeline.rounds[0]
  const emailTpl = resolveEmailTemplate(auth, body)
  const sendEmails = body.sendEmails !== false
  const origin = typeof body.origin === 'string' ? body.origin : ''
  const nowIso = new Date().toISOString()
  const testId = randomUUID()

  // Resolve round-0 questions from a saved set (tailor generates later, per résumé).
  const questions: string[] =
    round0.source === 'set' && round0.questionSetId
      ? (db.questionSets.get(round0.questionSetId)?.questions.map((q) => q.text) ?? [])
      : []

  const created: PipelineInviteResult['created'] = []
  let emailed = 0, dryRun = false
  for (const c of candidates) {
    const pcId = randomUUID()
    const ctx: SendCtx = {
      testId, recruiterId: auth.uid, recruiterEmail: auth.email, recruiterName: null, nowIso,
      mode: round0.mode, questions, source: round0.source, config: round0.config, questionSetId: round0.questionSetId,
      pipeline: { pipelineId: pipeline.id, roundIndex: 0, pipelineCandidateId: pcId },
      origin, fromName: emailTpl?.sender?.fromName || 'TalbotIQ', company: emailTpl?.branding?.companyName || 'TalbotIQ', deadline: emailTpl?.deadlineText || '',
    }
    const row = await createAndSendInterview(ctx, c, emailTpl, sendEmails)
    const pc = { ...buildPipelineCandidate(pipeline, auth.uid, c, row.id, nowIso), id: pcId }
    db.pipelineCandidates.set(pc.id, pc)
    if (row.sent) emailed++
    if (row.status === 'failed' && row.error?.includes('dry-run')) dryRun = true
    created.push(row)
  }
  db.scheduleSave()
  const result: PipelineInviteResult = { pipelineId: pipeline.id, created, emailed, dryRun }
  res.status(201).json(result)
}))

export const __test = { owns, normalize, loadOwned, ALLOWED_ROUND_MODES, buildPipelineCandidate }
