import { useEffect, useRef, useState } from 'react';

// Tipos minimos de la Web Speech API (no estan en lib.dom de TypeScript).
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getRecognitionConstructor(): SpeechRecognitionConstructor | undefined {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': 'Permiso de microfono denegado',
  'service-not-allowed': 'Permiso de microfono denegado',
  'no-speech': 'No se detecto voz',
  'audio-capture': 'No se encontro un microfono',
  network: 'El dictado necesita conexion a internet',
};

// Dictado por voz con la Web Speech API del navegador (Chrome y Edge): el
// texto reconocido se entrega en `onFinalText` a medida que se confirma
// cada frase; `interim` es lo que se esta reconociendo en este momento.
export function useSpeechRecognition(onFinalText: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onFinalTextRef = useRef(onFinalText);
  const supported = Boolean(getRecognitionConstructor());

  useEffect(() => {
    onFinalTextRef.current = onFinalText;
  }, [onFinalText]);

  useEffect(() => () => recognitionRef.current?.stop(), []);

  function start() {
    const Recognition = getRecognitionConstructor();
    if (!Recognition) {
      setError('Tu navegador no soporta dictado por voz (usa Chrome o Edge)');
      return;
    }
    const recognition = new Recognition();
    recognition.lang = navigator.language?.toLowerCase().startsWith('es') ? navigator.language : 'es-ES';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let pending = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) onFinalTextRef.current(result[0].transcript.trim());
        else pending += result[0].transcript;
      }
      setInterim(pending);
    };
    recognition.onerror = (event) => {
      if (event.error !== 'aborted') setError(ERROR_MESSAGES[event.error] ?? `Error de dictado: ${event.error}`);
    };
    recognition.onend = () => {
      setListening(false);
      setInterim('');
    };

    recognitionRef.current = recognition;
    setError(null);
    recognition.start();
    setListening(true);
  }

  function stop() {
    recognitionRef.current?.stop();
  }

  return { supported, listening, interim, error, start, stop };
}
