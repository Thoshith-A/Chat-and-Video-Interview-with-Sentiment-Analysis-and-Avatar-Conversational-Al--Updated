import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Owns ONE camera+mic stream for the whole Video Interview and records the
 * current answer with MediaRecorder. One shared stream (not one per question)
 * so the camera LED comes on once and mobile webviews don't juggle two streams.
 * The same stream can be tapped for facial-frame capture (Task 7).
 */
export function useAnswerRecorder() {
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const [ready, setReady] = useState(false)
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const acquire = useCallback(async () => {
    if (streamRef.current) return streamRef.current
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true })
      streamRef.current = stream
      setReady(true)
      return stream
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Camera/microphone access is required')
      throw e
    }
  }, [])

  const startRecording = useCallback(() => {
    const stream = streamRef.current
    if (!stream || recorderRef.current) return
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus') ? 'video/webm;codecs=vp8,opus' : 'video/webm'
    const rec = new MediaRecorder(stream, { mimeType: mime })
    chunksRef.current = []
    rec.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data) }
    rec.start()
    recorderRef.current = rec
    setRecording(true)
  }, [])

  /** Stop and resolve the recorded clip (waits for the final dataavailable). */
  const stopRecording = useCallback((): Promise<Blob> => {
    return new Promise((resolve) => {
      const rec = recorderRef.current
      if (!rec) { resolve(new Blob([], { type: 'video/webm' })); return }
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' })
        recorderRef.current = null
        setRecording(false)
        resolve(blob)
      }
      rec.stop()
    })
  }, [])

  // Release the camera on unmount (once — the whole interview shares this stream).
  useEffect(() => () => { streamRef.current?.getTracks().forEach((t) => t.stop()) }, [])

  const attachPreview = useCallback((el: HTMLVideoElement | null) => {
    if (el && streamRef.current) el.srcObject = streamRef.current
  }, [])

  return { ready, recording, error, acquire, startRecording, stopRecording, attachPreview, streamRef }
}
