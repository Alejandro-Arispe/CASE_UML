import { useEffect, useRef, useState } from 'react';
import { api } from '../../services/api';

const TARGET_SAMPLE_RATE = 16_000;

function wavFromBuffer(buffer: AudioBuffer): Blob {
  const samples = buffer.getChannelData(0);
  const bytes = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(bytes);
  const write = (offset: number, value: string) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  write(0, 'RIFF');
  view.setUint32(4, 36 + samples.length * 2, true);
  write(8, 'WAVE');
  write(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, TARGET_SAMPLE_RATE, true);
  view.setUint32(28, TARGET_SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  write(36, 'data');
  view.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return new Blob([bytes], { type: 'audio/wav' });
}

async function resampleAsWav(blob: Blob): Promise<Blob> {
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    const frames = Math.ceil(decoded.duration * TARGET_SAMPLE_RATE);
    const offline = new OfflineAudioContext(1, frames, TARGET_SAMPLE_RATE);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    return wavFromBuffer(await offline.startRendering());
  } finally {
    await context.close();
  }
}

export function useLocalSpeechRecognition(onFinalText: (text: string) => void) {
  const [available, setAvailable] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const onFinalTextRef = useRef(onFinalText);

  useEffect(() => {
    onFinalTextRef.current = onFinalText;
  }, [onFinalText]);

  useEffect(() => {
    api
      .get<{ available: boolean }>('/local-speech/health')
      .then(({ data }) => setAvailable(data.available))
      .catch(() => setAvailable(false));
  }, []);

  useEffect(
    () => () => {
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    },
    [],
  );

  async function start() {
    if (!available || recording || transcribing) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);
        if (!chunksRef.current.length) return;
        setTranscribing(true);
        setError(null);
        try {
          const wav = await resampleAsWav(new Blob(chunksRef.current, { type: recorder.mimeType }));
          const { data } = await api.post<{ text: string }>('/local-speech/transcribe', wav, {
            headers: { 'Content-Type': 'audio/wav' },
          });
          onFinalTextRef.current(data.text);
        } catch (reason) {
          setError(reason instanceof Error ? 'No se pudo transcribir con Whisper local' : 'No se pudo transcribir con Whisper local');
        } finally {
          setTranscribing(false);
        }
      };
      recorderRef.current = recorder;
      streamRef.current = stream;
      setError(null);
      recorder.start();
      setRecording(true);
    } catch {
      setError('No se pudo acceder al microfono');
    }
  }

  function stop() {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  }

  return { available, recording, transcribing, error, start, stop };
}
