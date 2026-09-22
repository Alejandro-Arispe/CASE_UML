import { Router } from 'express';
import { env } from '../../../config/env';
import { TokenService } from '../../../ports/out/TokenService';
import { requireAuth } from '../middlewares/requireAuth';

const TRANSCRIPTION_TIMEOUT_MS = 120_000;

function whisperUrl(path: string): string {
  return `${env.localWhisperUrl.replace(/\/$/, '')}${path}`;
}

// Proxy intencionalmente pequeno: el navegador no habla directamente con
// Whisper, que corre solo en localhost y no necesita exponer CORS. Ademas,
// asi el dictado local queda protegido por la misma sesion del CASE.
export function createLocalSpeechRoutes(tokenService: TokenService) {
  const router = Router();
  router.use(requireAuth(tokenService));

  router.get('/health', async (_req, res) => {
    try {
      const response = await fetch(whisperUrl('/health'), { signal: AbortSignal.timeout(2_000) });
      res.status(response.ok ? 200 : 503).json({ available: response.ok });
    } catch {
      res.status(503).json({ available: false });
    }
  });

  router.post('/transcribe', expressRawWav(), async (req, res, next) => {
    try {
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        return res.status(400).json({ error: 'No se recibio audio WAV' });
      }

      const form = new FormData();
      form.append('file', new Blob([new Uint8Array(req.body)], { type: 'audio/wav' }), 'dictado.wav');
      form.append('language', 'es');
      form.append('temperature', '0.0');
      form.append('response_format', 'json');

      const response = await fetch(whisperUrl('/inference'), {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(TRANSCRIPTION_TIMEOUT_MS),
      });
      if (!response.ok) {
        return res.status(503).json({ error: 'Whisper local no pudo transcribir el audio' });
      }

      const payload = (await response.json()) as { text?: unknown };
      const text = typeof payload.text === 'string' ? payload.text.trim() : '';
      if (!text) return res.status(422).json({ error: 'No se detecto voz con claridad' });
      return res.json({ text });
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        return res.status(504).json({ error: 'Whisper local tardo demasiado en responder' });
      }
      next(error);
    }
  });

  return router;
}

// Se limita el audio antes de que llegue al runtime nativo. Un minuto WAV
// mono a 16 kHz ocupa aproximadamente 1.9 MB, asi que 5 MB deja margen sin
// permitir cargas innecesariamente grandes.
function expressRawWav() {
  // Import diferido para conservar la ruta autocontenida sin tocar el parser
  // JSON global usado por las demas rutas.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const express = require('express') as typeof import('express');
  return express.raw({ type: 'audio/wav', limit: '5mb' });
}
