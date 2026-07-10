import type { Server } from 'node:http'
import { randomUUID } from 'node:crypto'
import { WebSocketServer, WebSocket } from 'ws'
import { Modality, StartSensitivity, EndSensitivity, type Session } from '@google/genai'
import { db } from '../store/db'
import { geminiClient, geminiEnabled, generateQuestions } from './gemini'
import { scoreSession } from './scoring'
import { createVoiceFlow, type VoiceFlow, type FlowAction, type TimerTag } from './voiceFlow'
import {
  PERSONA_PRESETS, VOICE_CATALOG, DEFAULT_LIVE_MODEL, DEFAULT_VOICE_CONFIG,
} from '../store/defaults'
import type {
  InterviewSession, InterviewTemplate, Turn, TimeOfDay,
  VoiceClientMessage, VoiceServerMessage,
} from '../../shared/types'

/**
 * Real-time Voice Interview Track. The candidate's mic audio streams to our
 * backend over a WebSocket; we relay to the Gemini Live native-audio API (the
 * key stays server-only) and stream the agent's audio back. The Live model runs
 * the interview naturally (greeting → "are you ready?" → questions → wrap-up)
 * from a strict, backend-authored ordered script; we capture both sides via Live
 * transcription and, on finish, rebuild a canonical transcript and reuse the
 * existing conversational scoring pipeline.
 */

const nowIso = () => new Date().toISOString()
const greetingWord = (tod?: TimeOfDay) =>
  tod === 'morning' ? 'Good morning' : tod === 'afternoon' ? 'Good afternoon' : tod === 'evening' ? 'Good evening' : 'Hello'

const FALLBACK_Q = [
  'Tell me about your background and what drew you to this role.',
  'Walk me through a project you’re proud of and your specific contribution.',
  'Describe a hard problem you solved recently and how you approached it.',
  'How do you handle disagreement with a teammate about a technical decision?',
  'Where do you want to grow over the next couple of years?',
]

/* ─── question plan (reuses the shared adaptive/fixed pipeline) ──────────── */

async function ensureQuestionPlan(session: InterviewSession, template: InterviewTemplate): Promise<void> {
  if (session.questions && session.questions.length > 0) return
  if (template.questionSource === 'fixed') {
    const set = template.fixedQuestionSetId ? db.questionSets.get(template.fixedQuestionSetId) : undefined
    session.questions = (set?.questions ?? []).map((q) => ({
      id: randomUUID(), text: q.text, category: q.category, idealAnswerNotes: q.idealAnswerNotes, autoSubmitted: false,
    }))
  } else {
    const count = template.adaptive?.numberOfQuestions ?? template.timing.numberOfQuestions ?? 5
    let gen: { text: string; category?: string; idealAnswerNotes?: string }[] = []
    try {
      if (geminiEnabled() && session.resumeText)
        gen = await generateQuestions({ resumeText: session.resumeText, role: template.role, seniority: template.seniority, count })
    } catch (err) {
      console.error('[voice] question generation failed, using fallback:', err)
    }
    if (gen.length === 0) gen = FALLBACK_Q.slice(0, count).map((text) => ({ text, category: 'General' }))
    session.questions = gen.map((g) => ({
      id: randomUUID(), text: g.text, category: g.category, idealAnswerNotes: g.idealAnswerNotes, autoSubmitted: false,
    }))
  }
  session.currentIndex = 0
  db.scheduleSave()
}

/* ─── English-locked transcription helpers ──────────────────────────────── */

/**
 * ASR language hints for the candidate's speech. For English interviews we hint
 * EVERY major English variant so any accent (Indian, British, American,
 * Australian…) is transcribed as English — never auto-detected as another
 * language/script. Non-English templates pass their configured code through.
 */
const ENGLISH_VARIANTS = ['en-IN', 'en-US', 'en-GB', 'en-AU']

/** Old Live models baked into stored templates — always upgraded to the current
 *  default (benchmarked 2026-07: ~2.8s to first audio vs ~740ms on 3.1-live). */
const LEGACY_LIVE_MODELS = new Set(['gemini-2.5-flash-native-audio-preview-09-2025'])
export function transcriptionLanguages(lang: string): string[] {
  return lang.trim().toLowerCase().startsWith('en') ? ENGLISH_VARIANTS : [lang]
}

/**
 * Bias the Live ASR toward this interview's own vocabulary — the role plus
 * acronyms (SQL, OOP), mixed-case/dotted tech terms (PostgreSQL, Node.js, C++),
 * and proper-noun phrases from the question plan — so accented technical terms
 * resolve to the right English words instead of drifting.
 */
export function adaptationPhrases(role: string, questions: string[]): string[] {
  const out = new Set<string>()
  if (role.trim()) out.add(role.trim().slice(0, 60))
  const text = questions.join('\n')
  // Acronyms / mixed-case / digit-, +/#- or dot-bearing tokens.
  for (const m of text.matchAll(/[A-Za-z][A-Za-z0-9+#.]*[A-Za-z0-9+#]/g)) {
    const w = m[0]
    if (w.length < 2 || w.length > 40) continue
    if (/^[A-Z]{2,}[0-9+#]*$/.test(w) || /[a-z][A-Z]/.test(w) || /[0-9+#]/.test(w) || /\w\.\w/.test(w)) out.add(w)
  }
  // Consecutive-capitalized proper-noun phrases: "Employer Worker Registration System".
  for (const m of text.matchAll(/[A-Z][a-z0-9]+(?:[ -][A-Z][a-z0-9]+)+/g)) out.add(m[0].slice(0, 60))
  return [...out].slice(0, 32)
}

/* ─── system instruction: persona + strict on-interview guardrails + plan ── */

function buildSystemInstruction(
  session: InterviewSession, template: InterviewTemplate, questions: string[], tod?: TimeOfDay,
): string {
  const persona = PERSONA_PRESETS.find((p) => p.id === template.voice?.personaId) ?? PERSONA_PRESETS[0]
  const name = session.candidate?.name && session.candidate.name !== 'Candidate' ? session.candidate.name : ''
  const role = `${template.seniority ? template.seniority + ' ' : ''}${template.role || 'this'}`
  const list = questions.map((q, i) => `${i + 1}. ${q}`).join('\n')
  const lang = template.voice?.language || 'en-US'
  const languageRule = lang.trim().toLowerCase().startsWith('en')
    ? `LANGUAGE: this interview is conducted ENTIRELY IN ENGLISH. Speak only English, and treat EVERYTHING the candidate says as English — candidates may have any accent (Indian, British, American, or other), but their words are English. Never switch to, mix in, or acknowledge any other language or script under any circumstances. If the candidate genuinely answers in another language, warmly ask them to continue in English.`
    : `LANGUAGE: this interview is conducted ENTIRELY in the language with code "${lang}". Speak only that language and expect the candidate's answers in it; never switch language or script mid-interview.`
  return [
    persona.stylePrompt,
    languageRule,
    `You are conducting a LIVE SPOKEN interview for a ${role} role. Speak naturally and warmly, like a real person on a phone call: use contractions, vary your phrasing. Keep every question SHORT: one or two spoken sentences. Speak in plain sentences; do not use em dashes or en dashes.`,
    `FLOW:
1. Open with a brief "${greetingWord(tod)}" greeting, warmly welcome the candidate${name ? ` by name (${name})` : ''}, add one short line on how this will go, then ask if they're ready to begin, and stop and wait.
2. If they clearly say yes, begin. If they're unsure or not ready, reassure them in one short line and ask again; only start on a clear yes.
3. Ask the questions in the list below IN ORDER, one at a time, phrased naturally and briefly. You MUST ask every single one before finishing. After each answer, give a brief, warm, VARIED acknowledgment (never reuse the same phrase), then ask the next one. Do NOT wrap up or say goodbye until you have asked and heard an answer to the FINAL question in the list.
4. Only AFTER the last question is answered, give a warm CLOSING: thank them sincerely, let them know that's everything and they're all done and free to leave the interview now, that our HR team will be in touch about the next steps, and that they're welcome to reach out to us anytime. Then stop and wait for them to respond. When they reply (e.g. "thank you"), you may say a brief goodbye.`,
    `THE QUESTIONS, IN ORDER — ask every one, do not add, skip, or reorder, and NEVER say their numbers aloud:\n${list}`,
    `STRICT RULES: Ask ONLY these questions. Do NOT introduce unrelated topics, trivia, or spontaneous tangents. No small talk beyond the opening greeting. If the candidate goes off-topic, rambles, or asks YOU questions, briefly and politely acknowledge, then steer straight back to the interview and the next planned question; do not get pulled into another conversation. Never announce question numbers. One question at a time. Cover ALL the questions, then close; never add extra questions of your own and never finish early.`,
    `If you ever receive a bracketed [DIRECTOR: ...] note, follow its instruction silently and never read it aloud.`,
  ].join('\n\n')
}

/* ─── per-connection session driver ─────────────────────────────────────── */

const scored = new Set<string>()

function sendJson(ws: WebSocket, msg: VoiceServerMessage) {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg))
}

async function handleConnection(ws: WebSocket, sessionId: string) {
  const session0 = db.sessions.get(sessionId)
  const template0 = session0 ? db.templates.get(session0.templateId) : undefined
  if (!session0 || !template0) { sendJson(ws, { type: 'error', message: 'Session not found' }); ws.close(); return }
  // Re-bind as definitely-defined consts so narrowing holds inside the closures below.
  const session: InterviewSession = session0
  const template: InterviewTemplate = template0
  if (session.track !== 'voice') { sendJson(ws, { type: 'error', message: 'Not a voice session' }); ws.close(); return }
  if (!geminiEnabled()) { sendJson(ws, { type: 'error', message: 'Voice interviews require a Gemini API key on the server' }); ws.close(); return }
  if (template.questionSource === 'adaptive' && !session.resumeText) {
    sendJson(ws, { type: 'error', message: 'A résumé is required before starting' }); ws.close(); return
  }

  const vcfg = template.voice ?? DEFAULT_VOICE_CONFIG
  const persona = PERSONA_PRESETS.find((p) => p.id === vcfg.personaId) ?? PERSONA_PRESETS[0]
  const voiceName = VOICE_CATALOG.find((v) => v.id === vcfg.voiceId)?.id ?? persona.defaultVoiceId

  // The question plan is generated asynchronously (a Gemini call for adaptive).
  // We attach the WS listeners synchronously below FIRST so an early 'ready'
  // message isn't dropped, then start once the plan is ready.
  let questions: string[] = []
  let planReady = false
  let pendingReady = false
  let pendingReadyTod: TimeOfDay | undefined

  // Live transcription buffers for the CURRENT turn; the flow controller
  // (server/services/voiceFlow.ts) owns coverage + answer bucketing + end logic.
  let greetingText = ''
  let pendingInterviewer = ''
  let pendingCandidate = ''
  let lastTranscriptAt = 0   // last candidate ASR event — latency anchor
  let turnAudioLogged = false
  let muted = false
  let started = false
  let flowStarted = false
  let finalized = false
  let live: Session | undefined
  let flow: VoiceFlow | undefined
  const timers: Partial<Record<TimerTag, ReturnType<typeof setTimeout>>> = {}

  const clearTimer = (tag: TimerTag) => { if (timers[tag]) { clearTimeout(timers[tag]!); delete timers[tag] } }
  const clearAllTimers = () => { (Object.keys(timers) as TimerTag[]).forEach(clearTimer) }

  // Execute the flow controller's decisions (the only place with I/O + timers).
  function runActions(actions: FlowAction[]) {
    for (const a of actions) {
      if (a.kind === 'nudge') {
        try { live?.sendClientContent({ turns: `[DIRECTOR: ${a.text}]`, turnComplete: true }) } catch { /* noop */ }
      } else if (a.kind === 'armTimer') {
        clearTimer(a.tag)
        timers[a.tag] = setTimeout(() => {
          if (finalized || !flow) return
          flushCandidate()                       // salvage a partial answer before a timeout end
          if (!finalized && flow) runActions(flow.onTimer(a.tag))
        }, a.ms)
      } else if (a.kind === 'clearTimer') {
        clearTimer(a.tag)
      } else if (a.kind === 'finalize') {
        finalize(a.reason, a.graceful)
        try { live?.close() } catch { /* noop */ }
      }
    }
  }

  // Bucket any in-progress (not-yet-turn-complete) candidate speech into the flow
  // BEFORE a terminal controller call, so a partial final answer isn't lost on an
  // End button, timeout, or disconnect. Must run before flow finalizes.
  function flushCandidate() {
    if (pendingCandidate.trim() && flow && !flow.finalized) {
      const t = pendingCandidate.trim()
      pendingCandidate = ''
      runActions(flow.onCandidateTurn(t))
    }
  }

  function finalize(reason: string, graceful: boolean) {
    if (finalized) return
    finalized = true
    clearAllTimers()
    pendingCandidate = ''

    // Build the scored transcript from the flow's per-question answer buckets
    // (aligned even when VAD split a spoken answer across turns).
    const answers = flow ? flow.answers : questions.map(() => '')
    const transcript: Turn[] = []
    if (greetingText.trim()) transcript.push({ id: randomUUID(), role: 'interviewer', content: greetingText.trim(), turnType: 'greeting', createdAt: nowIso() })
    let answered = 0
    for (let i = 0; i < questions.length; i++) {
      transcript.push({ id: randomUUID(), role: 'interviewer', content: questions[i], turnType: 'question', questionIndex: i, createdAt: nowIso() })
      const a = (answers[i] ?? '').trim()
      if (a) answered++
      transcript.push({ id: randomUUID(), role: 'candidate', content: a, questionIndex: i, createdAt: nowIso() })
    }
    session.transcript = transcript
    session.mode = 'conversational'
    session.plannedQuestionCount = questions.length
    session.currentIndex = answered
    if (session.status === 'in_progress' || session.status === 'created' || session.status === 'system_check') {
      session.status = 'completed'
      session.completedAt = nowIso()
    }
    db.scheduleSave()

    // Reuse the existing conversational scoring pipeline (fire-and-forget).
    if (!db.reports.has(session.id) && !scored.has(session.id)) {
      scored.add(session.id)
      scoreSession(session, template)
        .then((report) => { db.reports.set(session.id, report); db.scheduleSave() })
        .catch((err) => console.error('[voice] scoring failed for', session.id, err))
        .finally(() => scored.delete(session.id))
    }
    sendJson(ws, { type: 'ended', reason, graceful })
  }

  async function startLive(tod?: TimeOfDay) {
    if (started) return
    if (questions.length === 0) { sendJson(ws, { type: 'error', message: 'No questions available for this interview' }); return }
    started = true
    session.status = 'in_progress'
    session.startedAt = nowIso()
    db.scheduleSave()
    flow = createVoiceFlow(questions)

    try {
      // Lock the candidate-ASR to the interview language. English templates hint
      // ALL English variants so any accent stays English (never auto-detected as
      // another language/script, e.g. Devanagari), and the ASR is biased toward
      // the interview's own technical vocabulary.
      const interviewLang = vcfg.language || 'en-US'
      const asrLanguages = transcriptionLanguages(interviewLang)
      const asrPhrases = adaptationPhrases(template.role, questions)
      // Superseded Live models (baked into templates created under old defaults)
      // are transparently upgraded — benchmarked ~4× slower to first audio.
      const liveModel =
        vcfg.model && !LEGACY_LIVE_MODELS.has(vcfg.model) ? vcfg.model : DEFAULT_LIVE_MODEL
      const liveParams = (full: boolean) => ({
        model: liveModel,
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName } } },
          systemInstruction: buildSystemInstruction(session, template, questions, tod),
          inputAudioTranscription: full
            ? {
                languageHints: { languageCodes: asrLanguages },
                ...(asrPhrases.length ? { adaptationPhrases: asrPhrases } : {}),
              }
            : {},
          outputAudioTranscription: {},
          // Never let the model "think" silently before speaking — interview
          // turns are short and thinking added seconds of dead air per reply.
          ...(full ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
          // Snappy turn-taking: detect speech onset quickly, end turns readily
          // (HIGH is the Live default; LOW added noticeable lag after the
          // candidate stopped speaking), and keep a 500ms silence window so
          // natural thinking pauses aren't cut off.
          realtimeInputConfig: {
            automaticActivityDetection: {
              startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH,
              endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_HIGH,
              prefixPaddingMs: 20,
              silenceDurationMs: 500,
            },
          },
        },
        callbacks: {
          onopen: () => {
            if (flowStarted) return // paranoia: never double-start the flow on a retried connect
            flowStarted = true
            sendJson(ws, { type: 'state', phase: 'greeting' })
            if (flow) runActions(flow.start())
          },
          onmessage: (m: any) => {
            const sc = m?.serverContent
            // Agent audio out → relay to the client as raw BINARY PCM (24 kHz), no base64/JSON.
            let spoke = false
            for (const part of sc?.modelTurn?.parts ?? []) {
              if (part?.inlineData?.data && ws.readyState === WebSocket.OPEN) {
                ws.send(Buffer.from(part.inlineData.data, 'base64'))
                spoke = true
              }
            }
            if (spoke) {
              sendJson(ws, { type: 'state', phase: 'speaking' })
              if (!turnAudioLogged && lastTranscriptAt) {
                turnAudioLogged = true
                console.log(`[voice:lat] agent audio ${Date.now() - lastTranscriptAt}ms after candidate's last transcribed words`)
              }
            }
            if (sc?.outputTranscription?.text) {
              pendingInterviewer += sc.outputTranscription.text
              sendJson(ws, { type: 'caption', role: 'interviewer', text: pendingInterviewer, final: false })
            }
            if (sc?.inputTranscription?.text) {
              pendingCandidate += sc.inputTranscription.text
              lastTranscriptAt = Date.now()
              sendJson(ws, { type: 'state', phase: 'listening' })
              sendJson(ws, { type: 'caption', role: 'candidate', text: pendingCandidate, final: false })
            }
            // Barge-in: the candidate interrupted — flush client playback.
            if (sc?.interrupted) {
              pendingInterviewer = ''
              flow?.onInterrupted()
              if (vcfg.allowBargeIn) sendJson(ws, { type: 'interrupted' })
            }
            // Turn boundary: the candidate's answer (if any) precedes the agent's
            // reply. Feed both to the flow controller, which decides coverage +
            // when the wrap-up handshake is complete (never on raw turn counts).
            if (sc?.turnComplete) {
              turnAudioLogged = false
              if (pendingCandidate.trim()) {
                const text = pendingCandidate.trim()
                pendingCandidate = ''
                sendJson(ws, { type: 'caption', role: 'candidate', text, final: true })
                if (flow) runActions(flow.onCandidateTurn(text))
              }
              if (!finalized && pendingInterviewer.trim()) {
                const text = pendingInterviewer.trim()
                pendingInterviewer = ''
                if (!greetingText) greetingText = text // the first interviewer turn is the greeting
                sendJson(ws, { type: 'caption', role: 'interviewer', text, final: true })
                if (flow) runActions(flow.onInterviewerTurn(text))
              }
              // The agent's turn is over — it's the candidate's turn to speak.
              // (Showing "thinking" here read as system lag while it was really
              // waiting on the candidate.)
              if (!finalized) sendJson(ws, { type: 'state', phase: 'listening' })
            }
          },
          onerror: (e: any) => sendJson(ws, { type: 'error', message: e?.message || 'Voice engine error' }),
          onclose: () => { clearAllTimers(); if (!finalized && started) { if (flow) { flushCandidate(); if (!finalized) runActions(flow.onEnd('closed')) } else finalize('closed', false) } },
        },
      })

      try {
        live = await geminiClient().live.connect(liveParams(true))
      } catch (err) {
        // Some Live models may reject language hints / thinkingConfig — retry
        // with the maximally-compatible config rather than failing the interview.
        console.warn('[voice] live.connect with full config failed; retrying compatible:', err)
        live = await geminiClient().live.connect(liveParams(false))
      }

      // Kick off the greeting (native audio only speaks once prompted).
      live.sendClientContent({ turns: 'Begin the interview now: greet me and ask if I am ready to begin.', turnComplete: true })
    } catch (err: any) {
      sendJson(ws, { type: 'error', message: err?.message || 'Could not start the voice interview' })
      started = false
    }
  }

  ws.on('message', (raw, isBinary) => {
    // BINARY frame = raw mic PCM16 (16 kHz). Base64-encode server-side (cheap,
    // off the client's main thread) and forward straight to Gemini Live.
    if (isBinary) {
      if (!muted && live) live.sendRealtimeInput({ audio: { data: (raw as Buffer).toString('base64'), mimeType: 'audio/pcm;rate=16000' } })
      return
    }
    let msg: VoiceClientMessage
    try { msg = JSON.parse(raw.toString()) } catch { return }
    if (msg.type === 'ready') {
      // May arrive before the plan is ready — defer startLive until it is.
      pendingReadyTod = msg.timeOfDay
      if (planReady) void startLive(msg.timeOfDay)
      else pendingReady = true
    }
    else if (msg.type === 'mute') { muted = msg.muted }
    else if (msg.type === 'end') {
      if (flow) { flushCandidate(); if (!finalized) runActions(flow.onEnd('ended')) } else finalize('ended', false)
      try { live?.close() } catch { /* noop */ }
      ws.close()
    }
  })

  ws.on('close', () => {
    try { live?.close() } catch { /* noop */ }
    clearAllTimers()
    if (!finalized && started) { if (flow) { flushCandidate(); if (!finalized) runActions(flow.onEnd('closed')) } else finalize('closed', false) }
  })
  ws.on('error', () => { try { live?.close() } catch { /* noop */ } })

  sendJson(ws, { type: 'state', phase: 'connecting' })

  // Build the ordered question plan (async), then start if the client is ready.
  void (async () => {
    try {
      await ensureQuestionPlan(session, template)
      questions = session.questions.map((q) => q.text)
      if (questions.length === 0) { sendJson(ws, { type: 'error', message: 'No questions available for this interview' }); ws.close(); return }
      planReady = true
      if (pendingReady) void startLive(pendingReadyTod)
    } catch (err) {
      console.error('[voice] failed to prepare question plan:', err)
      sendJson(ws, { type: 'error', message: 'Could not prepare the interview' })
      ws.close()
    }
  })()
}

/** Mount the voice WebSocket relay on the existing HTTP server. */
export function attachVoiceWebSocket(server: Server) {
  const wss = new WebSocketServer({ noServer: true })
  server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '', 'http://localhost')
    const match = url.pathname.match(/^\/api\/voice\/([^/]+)$/)
    if (!match) return // let other upgrade handlers (if any) deal with it
    const sessionId = decodeURIComponent(match[1])
    wss.handleUpgrade(req, socket, head, (ws) => { void handleConnection(ws, sessionId) })
  })
}
