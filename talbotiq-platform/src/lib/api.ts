import type {
  InterviewTemplate,
  QuestionSet,
  CandidateSessionState,
  CreateSessionRequest,
  SubmitAnswerRequest,
  SaveDraftRequest,
  IntegrityEventRequest,
  SessionListItem,
  SessionReportView,
  TrackType,
  AppSettingsStatus,
  GenerateQuestionSetResult,
  ChatbotSessionState,
  SubmitChatAnswerRequest,
  SaveChatDraftRequest,
  BeginChatRequest,
  VoiceCatalog,
  AnalyticsSummary,
  AnalyticsFilters,
  AppUser,
  CandidateAssignedSession,
  ExtractCandidatesResult,
  CreateInvitesRequest,
  CreateInvitesResult,
  AvatarInterviewSettings,
  AvatarSettingsStatus,
  AvatarStartResponse,
} from '@shared/types'

const BASE = '/api'

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  if (res.status === 204) return undefined as T
  const text = await res.text()
  const data = text ? JSON.parse(text) : undefined
  if (!res.ok) {
    const message = (data && (data.error as string)) || `Request failed (${res.status})`
    throw new ApiError(message, res.status, data)
  }
  return data as T
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public payload?: unknown) {
    super(message)
  }
}

/* ─── Auth ──────────────────────────────────────────────────────────────────
 * The Firebase ID token is attached to every /api request by the global fetch
 * interceptor installed in AuthProvider. The role is NOT decided here — it lives
 * on Firestore users/{uid}.role (read live by the client, and read by the server
 * on each request). This endpoint just returns the current user's mirror view. */
export const authApi = {
  me: () => http<AppUser>('/auth/me'),
}

/* ─── Templates ─────────────────────────────────────────────────────────── */
export const templatesApi = {
  list: () => http<InterviewTemplate[]>('/templates'),
  get: (id: string) => http<InterviewTemplate>(`/templates/${id}`),
  create: (body: Partial<InterviewTemplate>) =>
    http<InterviewTemplate>('/templates', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: Partial<InterviewTemplate>) =>
    http<InterviewTemplate>(`/templates/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  remove: (id: string) => http<void>(`/templates/${id}`, { method: 'DELETE' }),
}

/* ─── Question Sets ─────────────────────────────────────────────────────── */
export const questionSetsApi = {
  list: () => http<QuestionSet[]>('/question-sets'),
  get: (id: string) => http<QuestionSet>(`/question-sets/${id}`),
  create: (body: Partial<QuestionSet>) =>
    http<QuestionSet>('/question-sets', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: Partial<QuestionSet>) =>
    http<QuestionSet>(`/question-sets/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  duplicate: (id: string) =>
    http<QuestionSet>(`/question-sets/${id}/duplicate`, { method: 'POST' }),
  remove: (id: string) => http<void>(`/question-sets/${id}`, { method: 'DELETE' }),
  generateFromResume: async (fd: FormData): Promise<GenerateQuestionSetResult> => {
    const res = await fetch(`${BASE}/question-sets/generate`, { method: 'POST', body: fd })
    const text = await res.text()
    const data = text ? JSON.parse(text) : undefined
    if (!res.ok) throw new ApiError((data && data.error) || `Generation failed (${res.status})`, res.status, data)
    return data as GenerateQuestionSetResult
  },
}

/* ─── Settings (server-side Gemini key) ─────────────────────────────────── */
export const settingsApi = {
  status: () => http<AppSettingsStatus>('/settings'),
  saveGeminiKey: (apiKey: string, model?: string) =>
    http<AppSettingsStatus>('/settings/gemini-key', {
      method: 'PUT',
      body: JSON.stringify({ apiKey, model }),
    }),
  clearGeminiKey: () => http<AppSettingsStatus>('/settings/gemini-key', { method: 'DELETE' }),
  // Tavus key — GLOBAL, single source of truth. Saving from the Settings page
  // pushes it server-side so it applies everywhere (candidate avatar interviews,
  // any previously-applied Setup config) in one step.
  saveTavusKey: (apiKey: string) =>
    http<{ tavusKeySet: boolean; tavusKeyMasked?: string }>('/settings/tavus-key', {
      method: 'PUT',
      body: JSON.stringify({ apiKey }),
    }),
  // Video Avatar (Tavus) — the Setup page's "Apply to Candidate Interviews".
  // Config + key are stored server-side; the status response is always masked.
  avatarStatus: () => http<AvatarSettingsStatus>('/settings/avatar'),
  applyAvatar: (body: AvatarInterviewSettings & { tavusKey?: string }) =>
    http<AvatarSettingsStatus>('/settings/avatar', { method: 'PUT', body: JSON.stringify(body) }),
}

/* ─── Sessions (candidate + recruiter) ──────────────────────────────────── */
export const sessionsApi = {
  create: (body: CreateSessionRequest) =>
    http<{ id: string }>('/sessions', { method: 'POST', body: JSON.stringify(body) }),
  // Bulk-invite: resolve a Firestore interview id into a local session (idempotent).
  claimInvite: (id: string) => http<CandidateSessionState>(`/sessions/${id}/claim`, { method: 'POST' }),
  state: (id: string) => http<CandidateSessionState>(`/sessions/${id}/state`),
  setTrack: (id: string, track: TrackType) =>
    http<CandidateSessionState>(`/sessions/${id}/track`, {
      method: 'POST',
      body: JSON.stringify({ track }),
    }),
  systemCheck: (id: string) =>
    http<CandidateSessionState>(`/sessions/${id}/system-check`, { method: 'POST' }),
  uploadResume: async (id: string, file: File, fullName?: string): Promise<CandidateSessionState> => {
    const fd = new FormData()
    fd.append('resume', file)
    // Candidate's full name, asked before upload — the AI interviewer uses it
    // to address them in questions (stored as session.candidate.name).
    if (fullName?.trim()) fd.append('fullName', fullName.trim())
    const res = await fetch(`${BASE}/sessions/${id}/resume`, { method: 'POST', body: fd })
    const text = await res.text()
    const data = text ? JSON.parse(text) : undefined
    if (!res.ok) throw new ApiError((data && data.error) || `Upload failed (${res.status})`, res.status, data)
    return data as CandidateSessionState
  },
  begin: (id: string) =>
    http<CandidateSessionState>(`/sessions/${id}/begin`, { method: 'POST' }),
  skipPrep: (id: string) =>
    http<CandidateSessionState>(`/sessions/${id}/skip-prep`, { method: 'POST' }),
  saveDraft: (id: string, body: SaveDraftRequest) =>
    http<{ ok: boolean }>(`/sessions/${id}/draft`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  submitAnswer: (id: string, body: SubmitAnswerRequest) =>
    http<CandidateSessionState>(`/sessions/${id}/answers`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  integrityEvent: (id: string, body: IntegrityEventRequest) =>
    http<{ ok: boolean; tabSwitchWarnings?: number; maxTabSwitchWarnings?: number }>(
      `/sessions/${id}/integrity-event`,
      { method: 'POST', body: JSON.stringify(body) },
    ),
  complete: (id: string) =>
    http<CandidateSessionState>(`/sessions/${id}/complete`, { method: 'POST' }),
  // Video Interview: upload the aggregated AWS Rekognition facial summary
  // (computed client-side from frames captured off the shared camera stream).
  facial: (id: string, summary: unknown) =>
    http<{ ok: boolean }>(`/sessions/${id}/facial`, { method: 'POST', body: JSON.stringify({ summary }) }),
  list: () => http<SessionListItem[]>('/sessions'),
  report: (id: string) => http<SessionReportView>(`/sessions/${id}/report`),
  // Candidate: the interviews assigned to the signed-in candidate's verified email.
  mine: () => http<CandidateAssignedSession[]>('/sessions/mine'),
  // Video Avatar (Tavus): the server creates the conversation from the recruiter's
  // applied Setup config — the client only receives the join URL. timeOfDay makes
  // the avatar's greeting time-appropriate ("Good morning …").
  avatarStart: (id: string, timeOfDay?: 'morning' | 'afternoon' | 'evening') =>
    http<AvatarStartResponse>(`/sessions/${id}/avatar/start`, { method: 'POST', body: JSON.stringify({ timeOfDay }) }),
  avatarTranscript: (id: string, body: { role: 'interviewer' | 'candidate'; text: string }) =>
    http<{ ok: boolean }>(`/sessions/${id}/avatar/transcript`, { method: 'POST', body: JSON.stringify(body) }),
  avatarComplete: (id: string) =>
    http<{ ok: boolean }>(`/sessions/${id}/avatar/complete`, { method: 'POST' }),
}

/* ─── Chatbot (conversational) track ────────────────────────────────────── */
export const chatbotApi = {
  begin: (id: string, body?: BeginChatRequest) =>
    http<ChatbotSessionState>(`/sessions/${id}/chat/begin`, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  state: (id: string) => http<ChatbotSessionState>(`/sessions/${id}/chat/state`),
  answer: (id: string, body: SubmitChatAnswerRequest) =>
    http<ChatbotSessionState>(`/sessions/${id}/chat/answer`, { method: 'POST', body: JSON.stringify(body) }),
  saveDraft: (id: string, body: SaveChatDraftRequest) =>
    http<{ ok: boolean }>(`/sessions/${id}/chat/draft`, { method: 'POST', body: JSON.stringify(body) }),
  skipThinking: (id: string) =>
    http<ChatbotSessionState>(`/sessions/${id}/chat/skip-thinking`, { method: 'POST' }),
  // The question is now presented (composer enabled) → start its clock server-side.
  questionPresented: (id: string) =>
    http<ChatbotSessionState>(`/sessions/${id}/chat/question-presented`, { method: 'POST' }),
}

/* ─── Bulk invite — candidate email/role extraction ─────────────────────── */
export const invitesApi = {
  extract: async (file: File, role: string): Promise<ExtractCandidatesResult> => {
    const fd = new FormData()
    fd.append('file', file)
    if (role) fd.append('role', role)
    const res = await fetch(`${BASE}/invites/extract`, { method: 'POST', body: fd })
    const text = await res.text()
    const data = text ? JSON.parse(text) : undefined
    if (!res.ok) throw new ApiError((data && data.error) || `Extraction failed (${res.status})`, res.status, data)
    return data as ExtractCandidatesResult
  },
  create: (body: CreateInvitesRequest) =>
    http<CreateInvitesResult>('/invites', { method: 'POST', body: JSON.stringify(body) }),
}

/* ─── Analytics (aggregate dashboard) ───────────────────────────────────── */
export const analyticsApi = {
  summary: (filters: AnalyticsFilters = {}) => {
    const qs = new URLSearchParams()
    if (filters.track) qs.set('track', filters.track)
    if (filters.templateId) qs.set('templateId', filters.templateId)
    if (filters.role) qs.set('role', filters.role)
    if (filters.dateFrom) qs.set('dateFrom', filters.dateFrom)
    if (filters.dateTo) qs.set('dateTo', filters.dateTo)
    const q = qs.toString()
    return http<AnalyticsSummary>(`/analytics${q ? `?${q}` : ''}`)
  },
}

/* ─── Voice track (catalog + preview; the live call uses a WebSocket) ────── */
export const voicesApi = {
  catalog: () => http<VoiceCatalog>('/voices'),
  // Returns base64 PCM (24 kHz) for the preview player.
  sample: (voiceId: string, text?: string) =>
    http<{ voiceId: string; mimeType: string; audio: string }>(`/voices/${voiceId}/sample`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),
}
