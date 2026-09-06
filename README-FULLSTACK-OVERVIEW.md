Added minimal full-stack API scaffold (Fastify + TypeScript), Dockerfile and docker-compose, plus a small client integration script and AI Reply button in the UI.

How to run (quick):

1. Copy .env.example -> .env and set MASTER_KEY and any MODEL_URL or WHISPER_URL you will use.
2. Build and run with Docker Compose:
   docker compose up --build
3. Open the web UI (serve the frontend as before with npx serve .) and click the new "AI Reply" button.

Notes:
- This is a scaffold: model servers (Whisper, LLM) are expected to be wired via MODEL_URL / WHISPER_URL environment variables. See server/README.md for more.
