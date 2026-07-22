import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Mic, MicOff, Video, VideoOff, PhoneOff, Loader2, AlertTriangle, Disc, Square, UserPlus } from 'lucide-react'
import { sessionsApi } from '@/lib/api'
import { uploadAnswerVideo } from '@/lib/storage'
import { useDailyCall } from '@/features/interview/useDailyCall'
import { DailyVideoTile } from '@/components/interview/DailyVideoTile'

/**
 * Recruiter's host screen for the live Two-way Interview (T6). Joins the Daily
 * room as OWNER (`sessionsApi.twowayHost`) — the candidate's `TwoWayStage`
 * (T5) knocks and waits until `admit(id)` here lets them in.
 *
 * Recording is client-side (`useDailyCall`'s `MediaRecorder` wrapper, not
 * Daily cloud recording — see that hook's docstring): the Record control here
 * just starts/stops the capture; the resulting Blob is uploaded to Firebase
 * Storage only once, in the End flow below, via the same
 * `uploadAnswerVideo` helper the (candidate-facing) Video Interview track
 * uses (questionId `'two-way'` namespaces the object under
 * `interviews/{sessionId}/`). If the recruiter manually stops the recording
 * before hitting End, that Blob is kept in `recordedBlobRef` so End still has
 * something to upload; if the recorder is still running at End, `stopRecording()`
 * there supplies the (final) Blob instead.
 *
 * Dark full-screen room — no recruiter chrome (Nav) — mirroring the
 * AvatarStage/VoiceStage/TwoWayStage shell so the live call reads the same on
 * both sides of the table.
 */
export default function LiveInterviewPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const dc = useDailyCall()

  const [hostError, setHostError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0) // bump to retry after a hard error
  const [recording, setRecording] = useState(false)
  const [ending, setEnding] = useState(false) // "uploading…/finalizing…" overlay

  const endingRef = useRef(false) // single-fire guard — don't double-complete
  const recordedBlobRef = useRef<Blob | null>(null) // last Blob from a manual stop, kept for End

  // Acquire the room as OWNER, then hand off to Daily. `cancelled` is a
  // per-invocation local (captured in this effect's closure), NOT a shared
  // ref — mirrors TwoWayStage's join effect so React 18 StrictMode's dev-only
  // mount→cleanup→remount can't un-cancel a stale invocation's in-flight
  // `twowayHost` call.
  useEffect(() => {
    if (!id) return
    let cancelled = false
    setHostError(null)

    const run = async () => {
      try {
        const { roomUrl, token } = await sessionsApi.twowayHost(id)
        if (cancelled) return
        await dc.join(roomUrl, token)
      } catch (e) {
        if (cancelled) return
        setHostError(e instanceof Error ? e.message : 'Could not start the interview room')
      }
    }
    void run()

    return () => { cancelled = true }
    // dc.join has a stable identity for the lifetime of this hook instance.
  }, [id, attempt, dc.join])

  const handleToggleRecord = useCallback(async () => {
    if (recording) {
      setRecording(false)
      const blob = await dc.stopRecording()
      if (blob) recordedBlobRef.current = blob
    } else {
      dc.startRecording()
      setRecording(true)
    }
  }, [recording, dc])

  const handleEnd = useCallback(async () => {
    if (!id || endingRef.current) return
    if (!window.confirm('End the interview now? The recording will be uploaded and the session will be marked complete.')) return
    endingRef.current = true
    setEnding(true)
    setRecording(false)

    let blob: Blob | null = null
    try {
      blob = await dc.stopRecording() // final segment, if still recording
    } catch { /* best-effort */ }
    if (!blob) blob = recordedBlobRef.current // fall back to an earlier manual stop

    let recordingUrl: string | undefined
    if (blob) {
      try {
        recordingUrl = await uploadAnswerVideo(id, 'two-way', blob)
      } catch (e) {
        console.error('[twoway] recording upload failed', e)
        toast.error('Could not upload the recording — finishing without it')
      }
    }

    try {
      await sessionsApi.twowayComplete(id, recordingUrl)
    } catch (e) {
      console.error('[twoway] complete failed', e)
      toast.error('Could not finalize the session — check Sessions and try again')
    }

    await dc.leave()
    navigate(`/sessions/${id}/report`)
  }, [id, dc, navigate])

  const candidate = dc.participants[0] ?? null
  const waiting = dc.waitingParticipants

  /* ── missing :id (shouldn't happen given the route) ── */
  if (!id) return null

  /* ── hard error — couldn't open the room / join failed ── */
  if (hostError || dc.callState === 'error') {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-neutral-950 px-4 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-bg text-danger">
          <AlertTriangle size={22} />
        </span>
        <h1 className="text-xl font-bold text-white">We couldn’t start the interview room</h1>
        <p className="max-w-md text-sm text-neutral-400">{hostError ?? dc.error ?? 'The call hit a connection problem.'}</p>
        <button
          onClick={() => setAttempt((a) => a + 1)}
          className="mt-2 rounded-full bg-white/10 px-5 py-2 text-sm font-semibold text-white hover:bg-white/20"
        >
          Try again
        </button>
      </div>
    )
  }

  /* ── connecting — acquiring the room + joining as owner ── */
  if (dc.callState !== 'joined') {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-neutral-950 text-neutral-300">
        <Loader2 size={26} className="animate-spin" />
        <p className="text-sm">Starting the interview room…</p>
      </div>
    )
  }

  /* ── the live room ── */
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-neutral-950">
      <div className="flex h-[56px] flex-shrink-0 items-center justify-between gap-3 border-b border-white/10 bg-neutral-950 px-4">
        <span className="flex items-center gap-2 truncate font-bold text-white">
          Live interview
          <span className="flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> Live
          </span>
          {recording && (
            <span className="flex items-center gap-1.5 rounded-full bg-red-500/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-red-300">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" /> Rec
            </span>
          )}
        </span>

        <div className="flex items-center gap-2">
          {waiting.map((w) => (
            <button
              key={w.id}
              onClick={() => void dc.admit(w.id)}
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-3.5 py-1.5 text-sm font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/25"
            >
              <UserPlus size={15} /> Admit {w.name || 'candidate'}
            </button>
          ))}
          <button
            onClick={handleEnd}
            disabled={ending}
            className="inline-flex items-center gap-1.5 rounded-full bg-red-500/15 px-4 py-1.5 text-sm font-semibold text-red-300 transition-colors hover:bg-red-500/25 disabled:opacity-60"
          >
            {ending ? <Loader2 size={15} className="animate-spin" /> : <PhoneOff size={15} />}
            End interview
          </button>
        </div>
      </div>

      <div className="relative flex-1 p-4">
        <div className="mx-auto h-full max-w-4xl">
          {candidate ? (
            <DailyVideoTile participant={candidate} label="Candidate" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-white/15 bg-neutral-900/40 text-center text-neutral-400">
              <Loader2 size={22} className="animate-spin" />
              <p className="text-sm">
                {waiting.length > 0 ? 'The candidate is waiting — admit them above.' : 'Waiting for the candidate to join…'}
              </p>
            </div>
          )}
        </div>
        {dc.localParticipant && (
          <div className="absolute bottom-4 right-6 w-40 shadow-lg sm:w-52">
            <DailyVideoTile participant={dc.localParticipant} label="You" />
          </div>
        )}
      </div>

      <div className="border-t border-white/10 bg-neutral-950">
        <div className="mx-auto flex max-w-3xl items-center justify-center gap-4 px-4 py-5">
          <button
            onClick={dc.toggleMic}
            aria-pressed={dc.muted}
            className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-white/15 bg-white/5 text-white transition-all hover:bg-white/10"
            aria-label={dc.muted ? 'Unmute microphone' : 'Mute microphone'}
          >
            {dc.muted ? <MicOff size={22} className="text-red-400" /> : <Mic size={22} />}
          </button>
          <button
            onClick={() => void handleToggleRecord()}
            aria-pressed={recording}
            className={`flex h-14 w-14 items-center justify-center rounded-full border-2 transition-all ${
              recording ? 'border-red-400/40 bg-red-500/20 text-red-300' : 'border-white/15 bg-white/5 text-white hover:bg-white/10'
            }`}
            aria-label={recording ? 'Stop recording' : 'Start recording'}
          >
            {recording ? <Square size={20} /> : <Disc size={22} />}
          </button>
          <button
            onClick={handleEnd}
            disabled={ending}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-danger text-white shadow-md transition-transform hover:scale-105 disabled:opacity-60"
            aria-label="End interview"
          >
            <PhoneOff size={24} />
          </button>
          <button
            onClick={dc.toggleCam}
            aria-pressed={dc.camOff}
            className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-white/15 bg-white/5 text-white transition-all hover:bg-white/10"
            aria-label={dc.camOff ? 'Turn camera on' : 'Turn camera off'}
          >
            {dc.camOff ? <VideoOff size={22} className="text-red-400" /> : <Video size={22} />}
          </button>
        </div>
      </div>

      {ending && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-neutral-950/90 text-neutral-200">
          <Loader2 size={26} className="animate-spin" />
          <p className="text-sm">{recordedBlobRef.current || recording ? 'Uploading recording…' : 'Finalizing…'}</p>
        </div>
      )}
    </div>
  )
}
