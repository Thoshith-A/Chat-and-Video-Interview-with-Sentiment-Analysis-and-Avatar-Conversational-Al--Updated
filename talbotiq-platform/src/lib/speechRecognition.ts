/**
 * Thin wrapper over the browser Web Speech API (zero cost, no key). Pure
 * utility: no React imports. The Web Speech types are not in the standard DOM
 * lib, so the minimal shape we use is declared here (strict, no `any`). Used by
 * Mimic Guide for voice input (speech-to-text).
 */

export type SpeechResult = { transcript: string; lang: string };

interface RecognitionAlternative {
  readonly transcript: string;
}
interface RecognitionResult {
  readonly 0: RecognitionAlternative;
  readonly length: number;
}
interface RecognitionResultList {
  readonly 0: RecognitionResult;
  readonly length: number;
}
interface RecognitionEvent {
  readonly results: RecognitionResultList;
}
interface RecognitionErrorEvent {
  readonly error: string;
}
interface SpeechRecognitionInstance {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: RecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

/** True when the current browser exposes the Web Speech API. */
export function isSpeechRecognitionSupported(): boolean {
  return Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition);
}

/**
 * Start a single-utterance recognition in `lang`. Calls `onResult` with the
 * final transcript, or `onError` with a message. Returns a stop function.
 */
export function startSpeechRecognition(
  lang: string,
  onResult: (result: SpeechResult) => void,
  onError: (error: string) => void,
  onEnd?: () => void,
): () => void {
  const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
  if (!Ctor) {
    onError("Speech recognition not supported in this browser.");
    return () => {};
  }

  const recognition = new Ctor();
  recognition.lang = lang;
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    onResult({ transcript, lang });
  };
  recognition.onerror = (event) => onError(event.error);
  if (onEnd) recognition.onend = onEnd;
  recognition.start();

  return () => recognition.stop();
}
