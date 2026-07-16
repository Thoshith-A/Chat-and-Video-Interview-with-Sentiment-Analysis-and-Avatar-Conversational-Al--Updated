import { getStorage, ref, uploadBytes, getDownloadURL, type FirebaseStorage } from 'firebase/storage'
import { firebaseAuth } from './firebase'

/**
 * Firebase Storage bootstrap. Reuses the initialised app from firebase.ts (via
 * firebaseAuth().app) so we don't double-init. The web config is public by
 * design; write access is enforced by storage.rules (scoped to the invited
 * candidate for the session, per the interviews/{sessionId} Firestore doc).
 */
let storageInstance: FirebaseStorage | undefined
function storage(): FirebaseStorage {
  if (!storageInstance) storageInstance = getStorage(firebaseAuth().app)
  return storageInstance
}

/**
 * Upload one recorded answer clip and return its download URL. Path is namespaced
 * per session + question so re-records overwrite cleanly. The returned URL carries
 * a Storage access token, so the recruiter report can play it back without auth.
 */
export async function uploadAnswerVideo(sessionId: string, questionId: string, blob: Blob): Promise<string> {
  // Derive the extension from the recorded blob's MIME type (e.g. Safari records
  // video/mp4, Chrome/Firefox record video/webm) so playback matches the codec.
  const ext = (blob.type.split('/')[1] || 'webm').split(';')[0]
  const path = `interviews/${sessionId}/${questionId}.${ext}`
  const r = ref(storage(), path)
  await uploadBytes(r, blob, { contentType: blob.type || 'video/webm' })
  return getDownloadURL(r)
}
