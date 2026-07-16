import { getStorage, ref, uploadBytes, getDownloadURL, type FirebaseStorage } from 'firebase/storage'
import { firebaseAuth } from './firebase'

/**
 * Firebase Storage bootstrap. Reuses the initialised app from firebase.ts (via
 * firebaseAuth().app) so we don't double-init. The web config is public by
 * design; write access is enforced by storage.rules (authenticated users only).
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
  const path = `interviews/${sessionId}/${questionId}.webm`
  const r = ref(storage(), path)
  await uploadBytes(r, blob, { contentType: blob.type || 'video/webm' })
  return getDownloadURL(r)
}
