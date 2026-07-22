# Two-way Interview Track

The **Two-way Interview** is a live, real-time video call between the recruiter and the candidate — the recruiter conducts the interview themselves (unlike the AI-driven Chatbot/Voice/Video Avatar tracks). It runs over **Daily** (managed WebRTC — rooms, SFU, TURN, low-latency all handled for us), is recorded client-side, then transcribed and scored the same way the other conversational tracks are.

## Overview

- **Track type:** `two_way` (alongside `chat`, `chatbot`, `voice`, `video_avatar`, `video`)
- **Not on the timed engine.** Like `chatbot`/`video_avatar`, `two_way` is exempt from the per-question `tick()` timer — it's one continuous live call, not a sequence of timed answers.
- **Conversation-scored.** `two_way` is treated as a conversation track (`isConversation`, `scoreSession`, `computeSpeechMetrics`) — the Gemini scorecard, transcript, speech metrics, and sentiment read all apply, computed from the post-call transcript.
- **Plus a manual review.** Because a human recruiter ran the call, the report also has an **Interviewer review** card (0–5 star rating + private notes) alongside the automated scorecard — the two are complementary, not exclusive.

## Flow

```
┌─ Recruiter ────────────────────────────────────────────────┐
│ 1. InviteWizard → "Two-way Interview" mode card → invite   │
│    candidate(s) by email (same bulk-invite flow as other   │
│    modes)                                                  │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌─ Candidate ────────────────────────────────────────────────┐
│ 2. Opens /take/:id → camera/mic system check → joins the   │
│    Daily room with a non-owner, KNOCKING token → waits in  │
│    the lobby ("Waiting for the interviewer to admit you…") │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌─ Recruiter ────────────────────────────────────────────────┐
│ 3. Opens /live/:id ("Join live interview" from Sessions) → │
│    joins the same room as OWNER → sees the candidate       │
│    knocking → clicks Admit                                 │
│ 4. Live call: both parties see/hear each other over Daily  │
│ 5. Recruiter clicks Record (client-side MediaRecorder,     │
│    capturing the remote candidate + local recruiter audio) │
│ 6. Recruiter clicks End → recording uploads to Firebase    │
│    Storage → session marked completed                      │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌─ Async Processing ─────────────────────────────────────────┐
│ • Deepgram transcribes the uploaded recording               │
│   (transcribeVideoUrl(), same as the Video Interview track) │
│ • Transcript stored as (interviewer, candidate) turns        │
│ • Gemini scores the transcript via the existing conversation │
│   scoring path (scoreSession / scoreConversation)            │
└──────────────────────────────────────────────────────────────┘
                            ↓
┌─ Recruiter Report ─────────────────────────────────────────┐
│ • Call recording playback                                   │
│ • Full transcript + Gemini scorecard (KPIs, summary,         │
│   strengths/improvements, recommendation)                    │
│ • Speech metrics + sentiment (from the transcript)            │
│ • Interviewer review: 0–5 stars + private notes, saved via    │
│   POST /sessions/:id/twoway/review                            │
└────────────────────────────────────────────────────────────┘
```

## Daily setup

The live call runs on [Daily](https://daily.co) — a managed WebRTC platform (already a dependency, `@daily-co/daily-js`). No self-hosted TURN/SFU, no raw WebRTC signaling to maintain.

1. **Create a Daily account** at [dashboard.daily.co](https://dashboard.daily.co) (a free account is enough — see "Daily tier" below).
2. **Get an API key**: Dashboard → Developers → copy the API key.
3. Set it server-side only:
   ```bash
   DAILY_API_KEY=your-daily-api-key
   ```
   The server (`server/services/dailyServer.ts`) uses it to:
   - **Create/fetch rooms** — one room per session, named deterministically (`room-{sessionId}`), self-expiring ~4h after creation.
   - **Mint short-lived meeting tokens** (~3h) — the **recruiter** gets an `is_owner: true` token; the **candidate** gets a non-owner token. **Only the room URL + token reach the browser — the API key itself never does** (mirrors the Tavus key pattern used for Video Avatar).
4. **Knocking waiting room.** Rooms are created with `enable_knocking: true` — this is Daily's built-in lobby: the candidate's client waits ("knocks") until the recruiter (owner) explicitly admits them. This is the two-way equivalent of the source app's custom lobby/admit flow, but handled entirely by Daily.
5. **Recording — client-side vs. Daily cloud.** This implementation records **client-side** via the browser's `MediaRecorder` API (capturing the remote candidate + local recruiter tracks into a WebM blob), which works on **any Daily plan including the free tier**. Daily also offers **cloud recording** (`enable_recording: 'cloud'` on the owner's token) — a paid-tier feature that composites and stores the call server-side, which is more reliable for long/flaky-network calls but requires a paid Daily plan and a webhook → fetch → Firebase Storage pipeline. If you upgrade later, swap the recorder in `useDailyCall.ts` / `LiveInterviewPage.tsx` for that webhook flow; the report/scoring pipeline downstream is unaffected either way (it just needs a `recordingUrl`).
6. Optional: `DAILY_SUBDOMAIN=yourteam` if you want to reference `yourteam.daily.co` links directly — not required to create rooms/mint tokens (the REST API returns the room URL for you).

If `DAILY_API_KEY` is unset, the Two-way Interview routes respond `503` ("The two-way interview is not configured — set DAILY_API_KEY on the server.") instead of failing silently — other tracks are unaffected.

## Firebase Storage prerequisite

The call recording uploads to **Firebase Storage** (the same bucket/project used by the Video Interview track), so:

1. **Enable Storage** on the shared Firebase project (`talbotiq-9cc4e`) if not already: Firebase Console → Build → Storage → Get started.
2. **Deploy `storage.rules`** (repo root) — it scopes both read and write on `/interviews/{sessionId}/{fileName}` to:
   - the **candidate** assigned to that session (`interviews/{sessionId}.candidateEmailLower` matches the caller's auth email), or
   - the **recruiter** who owns it (`interviews/{sessionId}.recruiterId` matches the caller's uid).

   For the Two-way Interview specifically, it's the **recruiter** who uploads the recording (on End) — the rules already cover this (see the "Two-way Interview" comment in `storage.rules`).
   ```bash
   firebase deploy --only storage
   ```
   There is no `firebase.json` checked into this repo — each deployment environment manages its own Firebase CLI config (see [Firebase CLI docs](https://firebase.google.com/docs/cli/setup)).
3. Rules also cap uploads at 50 MB and require `contentType` to match `video/*` — same constraints as the Video Interview track.

See `docs/VIDEO_INTERVIEW.md` for the general Storage-rules deploy/verify walkthrough (Rules Simulator, live smoke test) — it applies unchanged here.

## Required environment variables

All keys below are **server-side only**; the browser only ever receives a Daily room URL + short-lived token.

```bash
# Daily (live recruiter↔candidate call) — see "Daily setup" above
DAILY_API_KEY=
DAILY_SUBDOMAIN=          # optional

# Deepgram (post-call transcription — reuses the Video Interview track's key)
DEEPGRAM_API_KEY=

# Gemini (transcript scoring — reuses the shared key/model)
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash

# Firebase Admin (Storage + Firestore access — see docs/AUTH.md)
FIREBASE_PROJECT_ID=talbotiq-9cc4e
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

See `.env.example` for the exact defaults and inline comments.

## Capacitor / Android

The Two-way Interview needs the device camera + microphone, same as the Video Interview track. If building for Android via Capacitor:

1. `npx cap add android` (if not already added).
2. Edit `android/app/src/main/AndroidManifest.xml`:
   ```xml
   <uses-permission android:name="android.permission.CAMERA" />
   <uses-permission android:name="android.permission.RECORD_AUDIO" />
   <uses-feature android:name="android.hardware.camera" android:required="false" />
   ```
   (`required="false"` lets the app install on cameraless devices, though neither Video Interview nor Two-way will work without one.)
3. `npx cap sync android`, then build as usual (`./gradlew assembleDebug`).

**Daily works inside the Capacitor WebView** — `@daily-co/daily-js`'s `createCallObject()` uses standard `getUserMedia`/WebRTC, which Capacitor's Android WebView supports on API 24+ (same baseline as the Video Interview track's `MediaRecorder` usage). That said:

- **Test on a real device**, not just the emulator — emulator cameras/mics and WebRTC performance are not representative.
- Verify the knocking/admit flow specifically on-device: the candidate's knock-and-wait UI and the recruiter's admit button both depend on Daily's websocket signaling staying alive in the backgrounded/foregrounded WebView lifecycle.
- If recording (client `MediaRecorder`) is choppy on a given device/Android version, check codec support the same way the Video Interview track does (`MediaRecorder.isTypeSupported('video/webm')` → fallback).

## Known considerations / follow-ups

- **Daily tier.** Client-side `MediaRecorder` recording (the current default) works on any Daily plan. Daily **cloud recording** is a paid-tier upgrade that offloads compositing/reliability to Daily's servers — see "Daily setup" above for how to migrate to it later.
- **Scheduling.** v1 is "join now": the recruiter starts the room and the candidate knocks whenever they open their link. A scheduled start time + reminder emails is a future enhancement.
- **Transcript granularity.** v1 stores one (interviewer, candidate) transcript pair for the whole call. Deepgram diarization could split this into per-utterance turns later for a more granular per-question-style breakdown.
- **No facial analysis on this track.** Facial/engagement analysis (AWS Rekognition) is Video Interview-only for now — out of scope for the live call to keep latency low.

## Debugging

- **Room won't start / `503` on join:** `DAILY_API_KEY` is unset or invalid — check server logs and the `.env` value.
- **Candidate stuck "waiting to be admitted":** confirm the recruiter has actually opened `/live/:id` and joined (the room only accepts knocks once the owner is present); check the Daily dashboard's room activity.
- **Recording missing on the report:** check browser console on the recruiter's `/live/:id` tab for `MediaRecorder`/upload errors — same failure modes as the Video Interview track's upload (Storage rules, network, codec support).
- **No transcript/scorecard:** transcription is async (`transcribeVideoUrl`) — check server logs for `[twoway] transcription failed`; verify `DEEPGRAM_API_KEY`.
- **Manual review not saving:** confirm the recruiter is the session owner (`assertOwner`) and the session's `track` is `two_way` — the `/twoway/review` route 400s otherwise.

---

**Last updated:** 2026-07 (Task 8)
