# Server API (Node + TypeScript)

This directory contains a minimal Fastify-based API scaffold for EchoScribe fullstack-open-source branch.

Routes implemented (minimal):
- GET /api/health
- POST /api/ai/reply  — proxy to local MODEL_URL or echo
- POST /api/transcribe — forward multipart file to WHISPER_URL if configured
- POST /api/user/keys  — store encrypted keys (simple file storage)

See root .env.example for required env vars.
