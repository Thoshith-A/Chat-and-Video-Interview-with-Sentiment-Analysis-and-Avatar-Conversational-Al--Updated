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
import type { AuthContext, Pipeline, RoundDef, TrackType } from '../../shared/types'

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

export const __test = { owns, normalize, loadOwned, ALLOWED_ROUND_MODES }
