# EchoScribe — Speech to Text & Speech to Speech

A privacy-first, on-device speech-to-text and speech-to-speech PWA. Works on phone and PC, installable on mobile, supports built-in engines, custom APIs, and full speech-to-speech translation with audio replay.

## Features

### Two Modes
- **Speech to Text (STT)** — Dictate and get text. Copy, download, edit, replay.
- **Speech to Speech (S2S)** — Speak in one language, get translation spoken back in another.

### Three STT Engines
1. **Built-in (Web Speech API)** — Real-time, low latency, uses the browser's native speech recognition
2. **Whisper WASM** — OpenAI's Whisper model running fully in-browser via WebAssembly. Offline after first download. Three model sizes: Tiny (40MB), Base (80MB), Small (250MB)
3. **Custom API** — Bring your own API endpoint. Supports:
   - OpenAI Whisper API format (multipart/form-data)
   - Azure Speech Services (JSON + header)
   - Custom REST API (POST audio blob)

### Speech to Speech
- Translate spoken text to 19+ languages
- Translation providers: LibreTranslate, Google Translate (free), or your own custom API
- Automatic text-to-speech playback of translation
- Voice selection, speed, and pitch controls

### Audio Recording & Replay
- All engines that use MediaRecorder (Whisper, Custom API) save the audio
- Replay the recording anytime with the replay button
- Download transcript with original + translation

### Text to Speech
- Built-in TTS via Web Speech Synthesis API
- Custom TTS API support (send text, get audio back)
- Voice, speed, and pitch controls

### Other
- **100% privacy-first** — No backend. Settings and API keys stored in localStorage only
- **PWA** — Installable on phone, works offline (app shell cached)
- **20+ input languages** including all major Indian languages
- **Responsive** — Works on phone, tablet, desktop
- **Settings persistence** — All settings saved locally

## Quick Start

### Use directly
1. Open `index.html` in Chrome/Edge (for Web Speech) or any modern browser (for Whisper/Custom API)
2. Allow microphone access
3. Select your engine and language
4. Tap the mic and start speaking

### Install as PWA
1. Open in Chrome (Android) or Safari (iOS)
2. Browser menu → "Add to Home Screen" / "Install App"
3. Launch from home screen — works fullscreen like a native app

### Host it
```bash
npx serve .
# or
python3 -m http.server 8000
```

## Custom API Configuration

Open Settings (gear icon) to configure:

### STT API
- **API Endpoint URL** — Your speech-to-text API endpoint
- **API Key** — Stored locally only, sent only to your API
- **Format** — OpenAI / Azure / Custom
- **Model** — e.g., `whisper-1` (for OpenAI)

### Translation API
- **Provider** — Auto, LibreTranslate, Google (free), or Custom
- **Custom endpoint** — Your translation API URL
- **API Key** — For authenticated translation services

### TTS Engine
- **Built-in** — Uses Web Speech Synthesis (no setup needed)
- **Custom** — Your TTS API endpoint (send text, receive audio)

## Browser Support

| Feature | Chrome/Edge | Safari | Firefox |
|---------|------------|--------|----------|
| Built-in STT | Yes | Yes (iOS 14.5+) | No |
| Whisper WASM | Yes | Yes | Yes |
| Custom API | Yes | Yes | Yes |
| S2S Translation | Yes | Yes | Yes |
| TTS (Built-in) | Yes | Yes | Yes |
| PWA install | Yes (Android) | Yes (iOS) | Limited |
| Offline | Yes | Yes | Yes |

## Privacy

- **No backend.** The app is a static site.
- **No analytics.** Zero tracking.
- **API keys stored locally** in localStorage, never sent anywhere except your configured API.
- **Audio stays local** in Built-in and Whisper modes. In Custom API mode, audio is sent only to your configured endpoint.

## License

MIT
