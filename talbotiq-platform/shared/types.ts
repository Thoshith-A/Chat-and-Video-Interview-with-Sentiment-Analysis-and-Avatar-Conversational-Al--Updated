/**
 * Shared domain + API contract — imported by BOTH the Vite client and the
 * Express server. Keep this the single source of truth so the two sides
 * cannot drift. Everything here is type-only (erased at runtime).
 */

/* ─── Core config ───────────────────────────────────────────────────────── */

export type TrackType = 'chat' | 'chatbot' | 'video_avatar' | 'voice'
export type QuestionSource = 'adaptive' | 'fixed'

export interface TimingConfig {
  prepSeconds: number             // default 30
  answerSeconds: number           // default 120
  allowSkipPrep: boolean          // default true
  allowEarlySubmit: boolean       // default true
  warningThresholdSeconds: number // default 15
  numberOfQuestions?: number      // adaptive only; fixed derives from the set
  totalTimeCapSeconds?: number    // optional overall cap
}

export interface KpiDefinition {
  id: string
  label: string
  description: string
  weight: number   // relative weight; auto-normalized at scoring time
  enabled: boolean
}
export interface KpiRubric {
  kpis: KpiDefinition[]
  scoreScale: 100
}

export interface FixedQuestion {
  id: string
  text: string
  category?: string
  idealAnswerNotes?: string
}
export interface QuestionSet {
  id: string
  name: string
  questions: FixedQuestion[]
  createdAt: string
  updatedAt: string
}

export interface BrandingConfig {
  companyName: string
  logoUrl?: string
  accentColor: string
  welcomeMessage?: string
}

export interface IntegrityConfig {
  enforceFullscreen: boolean
  detectTabSwitch: boolean
  disablePasteInAnswers: boolean
  disableCopy: boolean
  maxTabSwitchWarnings: number
  logEvents: boolean
}

/* ─── Chatbot (conversational) track config ─────────────────────────────── */

export type InterviewMode = 'conversational' | 'timed'

/** Adaptive, résumé-grounded conversational settings (chatbot track). */
export interface AdaptiveConfig {
  role: string
  seniority?: string
  difficulty: DifficultyChoice
  style?: QuestionStyle          // 'technical' | 'non_technical' | 'mix'
  numberOfQuestions: number
  technicalCount?: number        // used when style === 'mix'
  nonTechnicalCount?: number     // used when style === 'mix'
  focusTopics?: string[]
  allowFollowUps: boolean
  maxFollowUpsPerQuestion: number
  interviewerTone?: string
  language?: string
}

/** Timing for the chatbot track's TIMED mode — kept separate from TimingConfig. */
export interface ConversationTimingConfig {
  thinkingSeconds: number          // default 30
  perQuestionSeconds: number       // default 120
  totalTimeCapSeconds?: number
  allowSkipThinking: boolean       // default true
  allowEarlySubmit: boolean        // default true
  warningThresholdSeconds: number  // default 15
}

/**
 * Optional per-question timer overlay for the CONVERSATIONAL chatbot track.
 * Reuses the timed-track countdown; only 'question' and (optionally) 'follow_up'
 * turns are timed — never greetings, the readiness step, or wrap-up. When
 * `enabled` is false the track behaves as the pure conversational flow.
 */
export interface ChatbotTimerConfig {
  enabled: boolean                 // master on/off (per interview type/template)
  perQuestionSeconds: number       // countdown per question (e.g. 120)
  timeFollowUps: boolean           // do follow-up questions also get a timer? (default true)
  followUpSeconds?: number         // optional distinct amount for follow-ups (else perQuestionSeconds)
  includeThinkingPhase: boolean    // optional short prep sub-timer before answering (default false)
  thinkingSeconds?: number         // used when includeThinkingPhase (e.g. 20)
  warningThresholdSeconds: number  // ring turns amber→red / show warning (e.g. 15)
  allowEarlySubmit: boolean        // candidate can submit before time is up (default true)
  autoSubmitOnExpiry: boolean      // auto-advance at 0 (default true)
  perQuestionOverrides?: Record<string, number> // custom seconds for specific fixed-set question ids
}

/* ─── Voice track config ────────────────────────────────────────────────── */

/** Real-time engine. `gemini_live` = native-audio bidi stream (built). `pipeline`
 *  = Cloud STT→Gemini→TTS (typed flag; not yet implemented — needs GCP creds). */
export type VoiceEngine = 'gemini_live' | 'pipeline'

/** A selectable voice for the catalog/preview UI. */
export interface VoiceOption {
  id: string                       // prebuiltVoiceConfig.voiceName for gemini_live
  label: string
  gender?: 'male' | 'female' | 'neutral'
  language: string
  accent?: string
  engine: VoiceEngine
  description?: string
  sampleUrl?: string               // optional pre-rendered sample; else previewed live
}

/** A selectable interviewer character = style prompt + default voice + delivery. */
export interface InterviewPersona {
  id: string
  name: string
  description: string
  stylePrompt: string              // interviewer character injected into the system instruction
  defaultVoiceId: string
  speakingRate?: number            // pipeline TTS only
  pitch?: number                   // pipeline TTS only
}

/** Per-template voice configuration. */
export interface VoiceConfig {
  engine: VoiceEngine
  personaId: string
  voiceId: string                  // overrides the persona default when set
  allowBargeIn: boolean            // candidate can interrupt the agent
  language: string
  model?: string                   // Live model override (default: native-audio preview)
}

export interface InterviewTemplate {
  id: string
  name: string
  role: string
  seniority?: string
  track: TrackType
  questionSource: QuestionSource
  fixedQuestionSetId?: string
  timing: TimingConfig
  rubric: KpiRubric
  integrity: IntegrityConfig
  branding: BrandingConfig
  // Chatbot track (optional; ignored by the chat / video_avatar tracks)
  mode?: InterviewMode
  adaptive?: AdaptiveConfig
  fixedAllowFollowUps?: boolean
  conversationTiming?: ConversationTimingConfig
  chatbotTimer?: ChatbotTimerConfig   // optional per-question timer overlay (conversational track)
  voice?: VoiceConfig                 // voice track only
  createdAt: string
  updatedAt: string
}

/* ─── Session (server-held; never fully sent to the candidate) ──────────── */

export type InterviewPhase = 'prep' | 'answer'
export type SessionStatus =
  | 'created'       // exists, candidate hasn't begun
  | 'system_check'  // candidate on the system-check screen
  | 'in_progress'   // actively answering
  | 'completed'     // all answers submitted
  | 'expired'

export interface SessionQuestion {
  id: string
  text: string
  category?: string
  idealAnswerNotes?: string // SERVER-ONLY — never leaves the server
  prepStartedAt?: string
  answerStartedAt?: string
  submittedAt?: string
  answerText?: string       // chat track
  videoUrl?: string         // video avatar track
  autoSubmitted: boolean
  draft?: string            // last auto-saved in-progress text
}

export interface IntegrityEvent {
  type:
    | 'tab_switch'
    | 'window_blur'
    | 'paste_blocked'
    | 'copy_blocked'
    | 'fullscreen_exit'
    | string
  at: string
}

/**
 * Classifies each interviewer turn so the client can gate the per-question
 * timer. Only 'question' and 'follow_up' turns are ever timed; everything else
 * (greeting, readiness, acknowledgment, wrap-up) is free time.
 */
export type TurnType = 'greeting' | 'readiness' | 'question' | 'follow_up' | 'acknowledgment' | 'wrap_up'

/** A single conversational turn (chatbot track). Server-held source of truth. */
export interface Turn {
  id: string
  role: 'interviewer' | 'candidate'
  content: string
  turnType?: TurnType          // interviewer turns only; gates the per-question timer
  questionIndex?: number       // 0-based primary-question this belongs to
  isFollowUp?: boolean
  createdAt: string
  // Timed mode (an interviewer turn awaiting the candidate's answer):
  thinkingStartedAt?: string
  answerStartedAt?: string
  submittedAt?: string
  autoAdvanced?: boolean
  draft?: string               // candidate's in-progress answer to THIS interviewer turn
}

export interface InterviewSession {
  id: string
  templateId: string
  track: TrackType
  candidate: { name: string; email: string }
  status: SessionStatus
  questions: SessionQuestion[] // SERVER-HELD — never sent in full to the client
  currentIndex: number
  createdAt: string
  startedAt?: string
  completedAt?: string
  integrityEvents: IntegrityEvent[]
  tabSwitchCount: number
  resumeText?: string          // SERVER-ONLY
  // Chatbot track (conversational) — server-held; only revealed turns go out.
  mode?: InterviewMode
  transcript?: Turn[]
  plannedQuestionCount?: number
  followUpsThisQuestion?: number
  greetingTimeOfDay?: TimeOfDay   // candidate's local part-of-day, for the opening greeting
}

/** Candidate's local part-of-day, derived client-side and sent at session start. */
export type TimeOfDay = 'morning' | 'afternoon' | 'evening'

/* ─── Scoring / results ─────────────────────────────────────────────────── */

export type Recommendation = 'strong_yes' | 'yes' | 'maybe' | 'no'

export interface PerQuestionResult {
  questionId: string
  kpiScores: Record<string, number> // keyed by KpiDefinition.id, 0–100
  feedback: string
}
export interface ResultReport {
  sessionId: string
  perQuestion: PerQuestionResult[]
  kpiAverages: Record<string, number>
  overallScore: number          // weighted, computed server-side (not by the model)
  summary: string
  strengths?: string[]
  improvements?: string[]
  recommendation?: Recommendation
  generatedAt: string
  degraded?: boolean            // true when scoring fell back (no/failed Gemini)
}

/* ─── Client-safe DTOs (what the candidate browser is allowed to receive) ── */

export interface PublicTimingView {
  prepSeconds: number
  answerSeconds: number
  allowSkipPrep: boolean
  allowEarlySubmit: boolean
  warningThresholdSeconds: number
}

/**
 * The ONLY session view the candidate client ever receives. Note: no future
 * questions, no idealAnswerNotes, no categories — just the current question.
 */
export interface CandidateSessionState {
  sessionId: string
  status: SessionStatus
  track: TrackType
  phase: InterviewPhase | null     // null outside an active question
  remainingSeconds: number         // server-computed
  totalPhaseSeconds: number        // prep or answer total, for ring math
  question: { id: string; text: string } | null // CURRENT only
  progress: { current: number; total: number }   // e.g. 3 of 8
  draft: string
  timing: PublicTimingView
  branding: BrandingConfig
  integrity: IntegrityConfig
  tabSwitchWarnings: number
  awaitingResume: boolean          // adaptive track needs a résumé before starting
}

/* ─── API request bodies ────────────────────────────────────────────────── */

export interface CreateSessionRequest {
  templateId: string
  candidate: { name: string; email: string }
  track?: TrackType
}
export interface SubmitAnswerRequest {
  questionId: string   // must equal the current question (anti-tamper)
  answerText?: string
  videoUrl?: string
}
export interface SaveDraftRequest {
  questionId: string
  draft: string
}
export interface IntegrityEventRequest {
  type: IntegrityEvent['type']
}

/* ─── Recruiter views ───────────────────────────────────────────────────── */

export interface SessionListItem {
  id: string
  candidate: { name: string; email: string }
  templateId: string
  templateName: string
  track: TrackType
  status: SessionStatus
  createdAt: string
  startedAt?: string
  completedAt?: string
  overallScore?: number
}

export interface SessionReportQuestion {
  id: string
  text: string
  category?: string
  answerText?: string
  videoUrl?: string
  timeUsedSeconds?: number
  autoSubmitted: boolean
}
export interface SessionReportView {
  session: {
    id: string
    candidate: { name: string; email: string }
    templateName: string
    track: TrackType
    status: SessionStatus
    createdAt: string
    startedAt?: string
    completedAt?: string
    questions: SessionReportQuestion[]
    integrityEvents: IntegrityEvent[]
    tabSwitchCount: number
  }
  rubric: KpiRubric
  report: ResultReport | null
}

export interface ApiError {
  error: string
}

/* ─── Analytics (aggregate dashboard) ───────────────────────────────────── */

/** Query filters for GET /api/analytics (all optional; omitted = no filter). */
export interface AnalyticsFilters {
  track?: TrackType
  templateId?: string
  role?: string
  dateFrom?: string   // ISO date/time; sessions completed on/after are included
  dateTo?: string     // ISO date/time; sessions completed on/before are included
}

/**
 * Real aggregate metrics computed server-side from stored ResultReports joined
 * with their sessions. Only `scored` sessions contribute to score stats; the
 * funnel counts every session. Empty/no-match filters return zeros + [].
 */
export interface AnalyticsSummary {
  totals: { created: number; started: number; completed: number; scored: number }
  completionRate: number                 // completed / created, 0–1
  averageOverall: number                 // mean overallScore across scored sessions
  scoreDistribution: { bucket: string; count: number }[]  // 0-20 … 81-100
  kpiAverages: { kpiId: string; label: string; average: number; coverage: number }[]
  byTrack: { track: TrackType; count: number; averageOverall: number; completionRate: number }[]
  byRole: { role: string; count: number; averageOverall: number }[]
  byTemplate: { templateId: string; name: string; count: number; averageOverall: number }[]
  trend: { date: string; count: number; averageOverall: number }[]   // by completion day (UTC)
  timeStats: { avgDurationSeconds: number; avgTimePerQuestionSeconds: number }
  recommendationDistribution: { recommendation: string; count: number }[]
  integrityFlagRate: number              // fraction of scored sessions with ≥1 integrity event
  topCandidates: { sessionId: string; name: string; role?: string; overallScore: number }[]
  generatedAt: string
}

/* ─── Resume → Question Set generation (Gemini) ─────────────────────────── */

export type QuestionStyle = 'technical' | 'non_technical' | 'mix'
export type QuestionDifficulty = 'easy' | 'medium' | 'hard'
export type DifficultyChoice = QuestionDifficulty | 'mixed'
export type GeminiModel = 'gemini-2.5-flash' | 'gemini-2.5-pro'

export interface GeneratedInterviewQuestion {
  text: string
  type: 'technical' | 'non_technical'
  category: string
  difficulty: QuestionDifficulty
  skillTag: string
  rationale: string
}

export interface GenerateQuestionSetResult {
  questions: GeneratedInterviewQuestion[]
  suggestedName: string
}

/** Server settings status — the key value is NEVER returned, only a masked hint. */
export interface AppSettingsStatus {
  geminiKeySet: boolean
  geminiKeyMasked?: string
  source: 'saved' | 'env' | 'none'
  model: string
}

/* ─── Chatbot track — client-safe DTOs & requests ───────────────────────── */

export interface ChatbotPublicTiming {
  mode: InterviewMode
  enabled: boolean          // this interview times question turns (legacy timed mode OR chatbotTimer)
  thinkingSeconds: number   // reflects the CURRENT turn's effective timing
  perQuestionSeconds: number
  allowSkipThinking: boolean
  allowEarlySubmit: boolean
  warningThresholdSeconds: number
}

/** A revealed turn the candidate is allowed to see (no server-only fields). */
export interface ChatbotTurnView {
  id: string
  role: 'interviewer' | 'candidate'
  content: string
  turnType?: TurnType
  questionIndex?: number
  isFollowUp?: boolean
}

/**
 * The ONLY conversational view the candidate receives. Contains the transcript
 * already revealed turn-by-turn — never the plan or any upcoming question.
 */
export interface ChatbotSessionState {
  sessionId: string
  status: SessionStatus
  track: TrackType   // 'chatbot' or 'video_avatar' — both use the conversational engine
  transcript: ChatbotTurnView[]
  awaitingInterviewer: boolean       // server is generating the next turn
  finished: boolean
  phase: 'thinking' | 'answer' | null // set only while a timed question turn is armed
  remainingSeconds: number
  totalPhaseSeconds: number
  currentTurnTimed: boolean           // the awaiting turn is a timed question/follow-up turn
  currentTurnId: string | null        // interviewer turn being answered (anti-tamper)
  progress: { current: number; total: number }
  draft: string
  timing: ChatbotPublicTiming
  branding: BrandingConfig
  integrity: IntegrityConfig
  tabSwitchWarnings: number
  awaitingResume: boolean
}

export interface BeginChatRequest {
  timeOfDay?: TimeOfDay   // candidate's local part-of-day for a time-aware greeting
}
export interface SubmitChatAnswerRequest {
  turnId: string        // must equal currentTurnId (anti-tamper / stale guard)
  answerText: string
}
export interface SaveChatDraftRequest {
  turnId: string
  draft: string
}

/* ─── Voice track — catalog + realtime WS protocol ──────────────────────── */

/** GET /api/voices — browsable catalog for the recruiter picker. */
export interface VoiceCatalog {
  voices: VoiceOption[]
  personas: InterviewPersona[]
}

/** High-level state of the live call, surfaced to the candidate UI. */
export type VoicePhase =
  | 'connecting'   // opening mic + WS
  | 'greeting'     // agent greeting / asking readiness
  | 'listening'    // candidate is speaking / mic open
  | 'thinking'     // agent processing (natural pause, NOT a forced 3s delay)
  | 'speaking'     // agent audio is playing
  | 'ended'        // interview complete
  | 'error'

/** A caption line for the optional on-screen transcript. */
export interface VoiceCaption {
  role: 'interviewer' | 'candidate'
  text: string
  final: boolean
}

/** Messages the SERVER pushes to the client over the WS (JSON, except audio). */
export type VoiceServerMessage =
  | { type: 'state'; phase: VoicePhase }
  | { type: 'audio'; data: string; mimeType: string }   // base64 PCM 24k from the agent
  | { type: 'caption'; role: 'interviewer' | 'candidate'; text: string; final: boolean }
  | { type: 'interrupted' }                              // barge-in: flush playback
  | { type: 'ended'; reason?: string; graceful?: boolean } // graceful=false ⇒ interrupted, not a real finish
  | { type: 'error'; message: string }

/** Messages the CLIENT sends to the server over the WS. */
export type VoiceClientMessage =
  | { type: 'ready'; timeOfDay?: TimeOfDay }             // mic granted; begin the interview
  | { type: 'audio'; data: string }                     // base64 PCM 16k mic chunk
  | { type: 'mute'; muted: boolean }
  | { type: 'end' }
