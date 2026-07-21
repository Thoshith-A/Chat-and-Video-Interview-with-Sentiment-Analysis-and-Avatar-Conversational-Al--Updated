import { useCallback, useEffect, useRef, useState } from 'react'
import DailyIframe from '@daily-co/daily-js'
import type { DailyCall, DailyParticipant } from '@daily-co/daily-js'

export type CallState = 'idle' | 'joining' | 'joined' | 'left' | 'error'

export interface WaitingParticipant {
  id: string
  name: string
}

/**
 * Reusable Daily "call object" (headless — no iframe UI) wrapper for the
 * live two-way video call. Shared by the candidate room (T5) and the
 * recruiter room (T6): both just need join/leave, the remote+local
 * participant tracks, mic/cam toggles, the recruiter's waiting-room admit
 * flow, and (recruiter-side) a client MediaRecorder capture of the call to
 * upload afterwards (T6/T7) — Daily's own cloud recording is not used.
 *
 * One call object per mount. `join()` creates it; `leave()` and unmount both
 * tear it down (idempotent — safe to call either more than once).
 */
export function useDailyCall() {
  const callRef = useRef<DailyCall | null>(null)
  const joiningRef = useRef(false)
  const listenersOffRef = useRef<(() => void) | null>(null)

  const [callState, setCallState] = useState<CallState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [participants, setParticipants] = useState<DailyParticipant[]>([])
  const [localParticipant, setLocalParticipant] = useState<DailyParticipant | null>(null)
  const [waitingParticipants, setWaitingParticipants] = useState<WaitingParticipant[]>([])
  const [muted, setMuted] = useState(false)
  const [camOff, setCamOff] = useState(false)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const recordedChunksRef = useRef<Blob[]>([])

  // co.participants() is the authoritative source — we just mirror it into
  // state (split local vs. remote) whenever Daily tells us something changed.
  const refreshParticipants = useCallback(() => {
    const co = callRef.current
    if (!co) return
    const all = co.participants()
    const remote: DailyParticipant[] = []
    let local: DailyParticipant | null = null
    Object.values(all).forEach((p) => {
      if (p.local) local = p
      else remote.push(p)
    })
    setParticipants(remote)
    setLocalParticipant(local)
    setMuted(!co.localAudio())
    setCamOff(!co.localVideo())
  }, [])

  const refreshWaiting = useCallback(() => {
    const co = callRef.current
    if (!co) return
    const all = co.waitingParticipants()
    setWaitingParticipants(Object.values(all).map((w) => ({ id: w.id, name: w.name })))
  }, [])

  const stopRecordingTracks = useCallback(() => {
    // Only stop the MediaRecorder — never the underlying persistentTracks,
    // which belong to Daily's call object and are still driving the live call.
    try { recorderRef.current?.stop() } catch { /* already stopped */ }
    recorderRef.current = null
    recordedChunksRef.current = []
  }, [])

  const teardown = useCallback(() => {
    stopRecordingTracks()
    listenersOffRef.current?.()
    listenersOffRef.current = null
    const co = callRef.current
    callRef.current = null
    if (co) {
      try { void co.leave() } catch { /* best-effort */ }
      try { void co.destroy() } catch { /* best-effort */ }
    }
  }, [stopRecordingTracks])

  const join = useCallback(async (roomUrl: string, token: string) => {
    if (joiningRef.current || callRef.current) return // guard double-join
    joiningRef.current = true
    setError(null)
    setCallState('joining')
    let co: DailyCall | null = null
    try {
      co = DailyIframe.createCallObject({ subscribeToTracksAutomatically: true })
      callRef.current = co

      const onParticipantChange = () => refreshParticipants()
      const onWaitingChange = () => refreshWaiting()
      const onError = (ev: { errorMsg?: string }) => {
        setError(ev.errorMsg ?? 'Call error')
        setCallState('error')
      }
      const onLeftMeeting = () => setCallState((s) => (s === 'error' ? s : 'left'))

      co.on('participant-joined', onParticipantChange)
      co.on('participant-updated', onParticipantChange)
      co.on('participant-left', onParticipantChange)
      co.on('waiting-participant-added', onWaitingChange)
      co.on('waiting-participant-updated', onWaitingChange)
      co.on('waiting-participant-removed', onWaitingChange)
      co.on('error', onError)
      co.on('left-meeting', onLeftMeeting)

      listenersOffRef.current = () => {
        try {
          co!.off('participant-joined', onParticipantChange)
          co!.off('participant-updated', onParticipantChange)
          co!.off('participant-left', onParticipantChange)
          co!.off('waiting-participant-added', onWaitingChange)
          co!.off('waiting-participant-updated', onWaitingChange)
          co!.off('waiting-participant-removed', onWaitingChange)
          co!.off('error', onError)
          co!.off('left-meeting', onLeftMeeting)
        } catch { /* call object may already be destroyed */ }
      }

      await co.join({ url: roomUrl, token })
      refreshParticipants()
      refreshWaiting()
      setCallState('joined')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to join the call')
      setCallState('error')
      listenersOffRef.current?.()
      listenersOffRef.current = null
      callRef.current = null
      try { await co?.destroy() } catch { /* best-effort */ }
    } finally {
      joiningRef.current = false
    }
  }, [refreshParticipants, refreshWaiting])

  const leave = useCallback(async () => {
    const co = callRef.current
    stopRecordingTracks()
    listenersOffRef.current?.()
    listenersOffRef.current = null
    callRef.current = null
    if (co) {
      try { await co.leave() } catch { /* best-effort */ }
      try { await co.destroy() } catch { /* best-effort */ }
    }
    setParticipants([])
    setLocalParticipant(null)
    setWaitingParticipants([])
    setCallState('left')
  }, [stopRecordingTracks])

  const toggleMic = useCallback(() => {
    const co = callRef.current
    if (!co) return
    const nextEnabled = !co.localAudio()
    co.setLocalAudio(nextEnabled)
    setMuted(!nextEnabled)
  }, [])

  const toggleCam = useCallback(() => {
    const co = callRef.current
    if (!co) return
    const nextEnabled = !co.localVideo()
    co.setLocalVideo(nextEnabled)
    setCamOff(!nextEnabled)
  }, [])

  const admit = useCallback(async (id: string) => {
    const co = callRef.current
    if (!co) return
    try {
      // Installed @daily-co/daily-js types (0.91) declare
      // grantRequestedAccess as a boolean, not `{ level: 'full' }`.
      await co.updateWaitingParticipant(id, { grantRequestedAccess: true })
    } catch { /* best-effort — the waiting-participant-* events resync state */ }
  }, [])

  const startRecording = useCallback(() => {
    const co = callRef.current
    if (!co || recorderRef.current) return
    const all = co.participants()
    const remote = Object.values(all).find((p) => !p.local) ?? null
    const local = all.local

    const tracks: MediaStreamTrack[] = []
    if (remote) {
      // Record the remote participant's video + audio, plus the local mic,
      // so the recruiter's own side of the conversation is captured too.
      const rv = remote.tracks.video.persistentTrack
      const ra = remote.tracks.audio.persistentTrack
      const la = local?.tracks.audio.persistentTrack
      if (rv) tracks.push(rv)
      if (ra) tracks.push(ra)
      if (la) tracks.push(la)
    } else {
      // Best-effort: no remote participant yet — record the local feed alone.
      const lv = local?.tracks.video.persistentTrack
      const la = local?.tracks.audio.persistentTrack
      if (lv) tracks.push(lv)
      if (la) tracks.push(la)
    }
    if (!tracks.length) return // nothing playable to record yet

    try {
      const stream = new MediaStream(tracks)
      recordedChunksRef.current = []
      const rec = new MediaRecorder(stream, { mimeType: 'video/webm' })
      rec.ondataavailable = (e) => { if (e.data.size) recordedChunksRef.current.push(e.data) }
      rec.start()
      recorderRef.current = rec
    } catch {
      recorderRef.current = null // recording unsupported — call continues without it
    }
  }, [])

  const stopRecording = useCallback((): Promise<Blob | null> => {
    const rec = recorderRef.current
    if (!rec) return Promise.resolve(null)
    return new Promise((resolve) => {
      rec.onstop = () => {
        const chunks = recordedChunksRef.current
        recorderRef.current = null
        recordedChunksRef.current = []
        resolve(chunks.length ? new Blob(chunks, { type: 'video/webm' }) : null)
      }
      try { rec.stop() } catch { recorderRef.current = null; resolve(null) }
    })
  }, [])

  // Full teardown on unmount — leave/destroy the call object, stop any
  // in-flight recorder, and detach listeners. Safe even if leave() was
  // already called (teardown/callRef are idempotent).
  useEffect(() => () => { teardown() }, [teardown])

  return {
    join,
    leave,
    participants,
    localParticipant,
    toggleMic,
    toggleCam,
    muted,
    camOff,
    startRecording,
    stopRecording,
    waitingParticipants,
    admit,
    callState,
    error,
  }
}
