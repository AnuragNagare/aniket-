import { useCallback, useRef, useState } from 'react';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';

export type DictationLocale = 'en-IN' | 'hi-IN';
type State = 'idle' | 'listening' | 'unavailable';

const MESSAGES: Record<string, string> = {
  'not-allowed': 'Allow the microphone in Settings to speak your update. You can still type it.',
  'no-speech': 'Didn’t catch that. Tap the microphone and try again.',
  'speech-timeout': 'Didn’t catch that. Tap the microphone and try again.',
  network: 'Voice typing needs a connection right now. You can type your update instead.',
  'service-not-allowed': 'Voice typing isn’t available on this phone. You can type your update instead.',
  'language-not-supported': 'This language isn’t available for voice typing on your phone. Try English, or type it.',
};
const UNAVAILABLE = MESSAGES['service-not-allowed']!;
const FALLBACK = 'Voice typing stopped. Tap the microphone to try again.';

/** Speech → text for the update box. Text is handed over only when a phrase is final. */
export function useDictation({ locale, onFinal }: { locale: DictationLocale; onFinal: (text: string) => void }) {
  const [state, setState] = useState<State>('idle');
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  useSpeechRecognitionEvent('result', (e: { isFinal: boolean; results: Array<{ transcript: string }> }) => {
    const text = e.results[0]?.transcript ?? '';
    if (e.isFinal) {
      setInterim('');
      if (text.trim()) onFinalRef.current(text);
    } else {
      setInterim(text);
    }
  });
  useSpeechRecognitionEvent('error', (e: { error: string }) => {
    setError(MESSAGES[e.error] ?? FALLBACK);
    setInterim('');
    setState('idle');
  });
  useSpeechRecognitionEvent('end', () => {
    setInterim('');
    setState((s) => (s === 'unavailable' ? s : 'idle'));
  });

  const start = useCallback(async () => {
    setError(null);
    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
      setState('unavailable');
      setError(UNAVAILABLE);
      return;
    }
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) {
      setError(MESSAGES['not-allowed']!);
      return;
    }
    ExpoSpeechRecognitionModule.start({ lang: locale, interimResults: true, continuous: true, addsPunctuation: true });
    setState('listening');
  }, [locale]);

  const stop = useCallback(() => {
    ExpoSpeechRecognitionModule.stop();
  }, []);

  return { state, interim, error, start, stop };
}
