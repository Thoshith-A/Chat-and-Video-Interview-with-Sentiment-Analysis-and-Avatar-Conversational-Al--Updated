import { Router } from 'express'
import { randomUUID } from 'node:crypto'
import multer from 'multer'
import { FieldValue } from 'firebase-admin/firestore'
import { ah, HttpError } from '../util/ah'
import { requireAuth } from '../middleware/auth'
import { adminFirestore } from '../services/firebaseAdmin'
import { extractCandidates } from '../services/inviteExtract'
import { sendMail, mailerReady } from '../services/email'
import { db } from '../store/db'
import { isValidEmail } from '../services/inviteExtract'
import type { CreateInvitesRequest, CreateInvitesResult, TrackType } from '../../shared/types'

export const invitesRouter = Router()

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

/**
 * Parse candidate emails + roles out of an uploaded file (CSV / Excel / PDF /
 * DOCX / TXT) for the bulk-invite review step. Returns rows for the recruiter to
 * confirm — it does NOT create invites or send anything. Recruiter-only.
 */
invitesRouter.post('/extract', upload.single('file'), ah(async (req, res) => {
  const file = (req as typeof req & { file?: { buffer: Buffer; mimetype: string; originalname: string } }).file
  if (!file) throw new HttpError(400, 'No file uploaded')
  const fallbackRole = typeof req.body?.role === 'string' ? req.body.role.trim() : ''
  const result = await extractCandidates(file.buffer, file.mimetype, file.originalname, fallbackRole)
  res.json(result)
}))

/* ── Flutter `interviews.type` supports only video|chat. Map the web's richer
 *    modes onto it (so the Flutter app never chokes) and keep the precise track
 *    in an additive `mode` field the web candidate flow reads. ────────────── */
export const typeForMode = (mode: TrackType): 'video' | 'chat' =>
  (mode === 'video_avatar' || mode === 'video' ? 'video' : 'chat')
export const MODE_LABEL: Record<string, string> = {
  chatbot: 'Chatbot', voice: 'Voice', video_avatar: 'Video Avatar', chat: 'Timed Q&A', video: 'Video Interview',
}

function inviteEmail(role: string, fromName: string, link: string, candidateEmail: string) {
  const subject = `Interview invitation — ${role}`
  const html =
    `<div style="font-family:Inter,Arial,sans-serif;font-size:15px;color:#0f172a;line-height:1.6">
      <p>Hi,</p>
      <p><strong>${fromName}</strong> has invited you to a screening interview for the <strong>${role}</strong> role.</p>
      <p>When you're ready, open your interview, upload your résumé, and begin — it takes just a few minutes:</p>
      <p><a href="${link}" style="display:inline-block;background:#0d5c3a;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Start your interview</a></p>
      <p style="background:#f0faf5;border:1px solid #dcf5e8;border-radius:8px;padding:10px 14px;color:#0a4a2e;font-size:13px">
        <strong>Important:</strong> this invitation is linked to <strong>${candidateEmail}</strong>.
        Sign in — or create your candidate account — using this exact email address to open it.
      </p>
      <p style="color:#64748b;font-size:13px">Or paste this link into your browser:<br>${link}</p>
      <p style="color:#94a3b8;font-size:12px">Sent via TalbotIQ.</p>
    </div>`
  return { subject, html }
}

/**
 * Create one `interviews/{id}` document per candidate (shared `testId`) in the
 * SAME Firestore collection the Flutter app uses, then email each candidate their
 * per-candidate link. Field names mirror APPLICATION_FLOW.md exactly; web-only
 * extras (`mode`, `role`, `screening`) are additive so Flutter ignores them.
 * Recruiter-only; each doc is stamped with the caller's uid as `recruiterId`.
 */
invitesRouter.post('/', ah(async (req, res) => {
  const auth = requireAuth(req)
  const body = req.body as CreateInvitesRequest

  const mode = body?.mode
  const role = (body?.role ?? '').trim()
  const source = body?.source
  if (!mode || !MODE_LABEL[mode]) throw new HttpError(400, 'A valid interview mode is required')
  if (!role) throw new HttpError(400, 'A candidate role is required')
  if (source !== 'tailor' && source !== 'set') throw new HttpError(400, 'source must be "tailor" or "set"')

  // Valid, de-duplicated candidates.
  const seen = new Set<string>()
  const candidates = (Array.isArray(body?.candidates) ? body.candidates : [])
    .map((c) => ({ email: (c?.email ?? '').trim(), role: (c?.role ?? role).trim() || role }))
    .filter((c) => c.email && isValidEmail(c.email) && !seen.has(c.email.toLowerCase()) && seen.add(c.email.toLowerCase()))
  if (candidates.length === 0) throw new HttpError(400, 'No valid candidate emails to invite')

  // Question source → the `questions` array stored on each interview.
  let questions: string[] = []
  if (source === 'set') {
    if (!body.questionSetId) throw new HttpError(400, 'A question set must be selected')
    const set = db.questionSets.get(body.questionSetId)
    if (!set) throw new HttpError(404, 'Question set not found')
    questions = set.questions.map((q) => q.text).filter(Boolean)
  }
  // 'tailor' → questions stay empty; they're generated per candidate after they upload their résumé.

  // Recruiter display name (best-effort) for the "from …" line.
  let recruiterName: string | undefined
  try { recruiterName = (await adminFirestore().collection('users').doc(auth.uid).get()).get('name') || undefined } catch { /* noop */ }
  const fromName = recruiterName || auth.email || 'A recruiter'

  const testId = randomUUID()
  const now = FieldValue.serverTimestamp()
  const col = adminFirestore().collection('interviews')
  const origin = (typeof body.origin === 'string' && body.origin) || ''

  const created: CreateInvitesResult['created'] = []
  let emailed = 0
  const dryRun = !mailerReady()

  for (const c of candidates) {
    const doc = {
      // ── APPLICATION_FLOW.md interviews schema (exact field names) ──
      testId,
      recruiterId: auth.uid,
      recruiterEmail: auth.email,
      recruiterName: recruiterName ?? null,
      candidateEmail: c.email,
      candidateEmailLower: c.email.toLowerCase(),
      candidateName: null,
      type: typeForMode(mode),
      title: `${role} — ${MODE_LABEL[mode]} interview`,
      prompt: '',
      questions,
      durationMinutes: 20,
      status: 'assigned',
      keyOverrides: {},
      maxAttempts: 1,
      attemptsUsed: 0,
      resultPublished: false,
      createdAt: now,
      updatedAt: now,
      // ── Web-only, additive (Flutter ignores unknown fields) ──
      mode,
      role: c.role,
      screening: {
        source,
        ...(source === 'tailor' && body.config ? {
          style: body.config.style,
          techCount: body.config.techCount,
          nonTechCount: body.config.nonTechCount,
          difficulty: body.config.difficulty,
          domains: Array.isArray(body.config.domains) ? body.config.domains : [],
          model: body.config.model,
        } : {}),
        ...(source === 'set' ? { questionSetId: body.questionSetId } : {}),
      },
    }
    const ref = await col.add(doc)
    const link = origin ? `${origin}/take/${ref.id}` : `/take/${ref.id}`
    created.push({ id: ref.id, email: c.email, link })

    const { subject, html } = inviteEmail(c.role || role, fromName, link, c.email)
    try {
      const r = await sendMail({ to: c.email, subject, html })
      if (r.sent) emailed++
    } catch (err) {
      console.error('[invites] email failed for', c.email, err)
    }
  }

  const result: CreateInvitesResult = { testId, created, emailed, dryRun }
  res.status(201).json(result)
}))
