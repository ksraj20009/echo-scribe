import Fastify from 'fastify';
import cors from 'fastify-cors';
import multipart from 'fastify-multipart';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { encrypt, decrypt } from './lib/crypto';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;
const MODEL_URL = process.env.MODEL_URL || '';
const WHISPER_URL = process.env.WHISPER_URL || '';
const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), 'data');

const server = Fastify({ logger: true });

await fs.mkdir(DATA_DIR, { recursive: true });

server.register(cors, { origin: true });
server.register(multipart);

server.get('/api/health', async () => ({ ok: true }));

server.post('/api/ai/reply', async (request, reply) => {
  try {
    const body = await request.body as any;
    // Accept both application/json and form posts
    const { transcript = '', ocr = '' } = body || {};
    const prompt = `User transcript:\n${transcript}\n\nOCR extracted:\n${ocr}\n\nProvide a concise assistant reply to the user based on the above.`;

    if (MODEL_URL) {
      // Forward prompt to configured model URL
      const res = await fetch(MODEL_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });
      if (!res.ok) {
        const txt = await res.text();
        request.log.error('Model returned ' + res.status + ': ' + txt);
        return reply.code(502).send({ error: 'Model endpoint error', status: res.status, body: txt });
      }
      const data = await res.json();
      // Expect model to return { text: '...' } or { result: '...' }
      const text = data.text || data.result || data.output || JSON.stringify(data);
      return { reply: text };
    }

    // Fallback: echo
    return { reply: `Echo assistant (no model configured). Transcript received with ${transcript.length} chars.` };
  } catch (err: any) {
    request.log.error(err);
    return reply.code(500).send({ error: err.message });
  }
});

server.post('/api/transcribe', async (request, reply) => {
  try {
    const mp = request.multipart ? request.multipart(handler, onEnd) : null;
    // Simple helper: if WHISPER_URL configured, forward the raw body
    if (!WHISPER_URL) {
      return reply.code(501).send({ error: 'No WHISPER_URL configured on server' });
    }

    // If multipart, pull the file and forward
    const parts = await request.parts();
    // NOTE: fastify-multipart streaming is more complex; as a minimal implementation,
    // we expect a single file field named 'file' that we save to disk then forward.
    let fileBuffer: Buffer | null = null;
    let filename = 'upload.webm';
    for await (const part of parts) {
      if (part.file) {
        const chunks: Buffer[] = [];
        for await (const chunk of part.file) chunks.push(Buffer.from(chunk));
        fileBuffer = Buffer.concat(chunks);
        filename = part.filename || filename;
      }
    }
    if (!fileBuffer) return reply.code(400).send({ error: 'No file received' });

    // Forward to WHISPER_URL
    const form = new FormData();
    form.append('file', new Blob([fileBuffer]), filename);
    // Note: Node's global FormData/Blob are available in Node 18+, otherwise polyfill is needed.
    const res = await fetch(WHISPER_URL, { method: 'POST', body: form as any });
    if (!res.ok) {
      const t = await res.text();
      return reply.code(502).send({ error: 'Whisper server error', body: t });
    }
    const data = await res.json();
    return { transcription: data };
  } catch (err: any) {
    request.log.error(err);
    return reply.code(500).send({ error: err.message });
  }
});

server.post('/api/user/keys', async (request, reply) => {
  try {
    const body = await request.body as any;
    const { provider = 'openai', key = '', store = false } = body || {};
    if (!key) return reply.code(400).send({ error: 'No key provided' });
    if (!store) return reply.send({ ok: true, message: 'Key received but not stored (ephemeral)' });

    const enc = encrypt(key);
    const file = path.join(DATA_DIR, 'keys.json');
    let db: any = {};
    try { db = JSON.parse(await fs.readFile(file, 'utf8')); } catch (e) { db = {}; }
    db[provider] = { created_at: new Date().toISOString(), key: enc };
    await fs.writeFile(file, JSON.stringify(db, null, 2), 'utf8');
    return { ok: true, stored: true };
  } catch (err: any) {
    request.log.error(err);
    return reply.code(500).send({ error: err.message });
  }
});

const start = async () => {
  try {
    await server.listen({ port: PORT, host: '0.0.0.0' });
    console.log('API listening on', PORT);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
