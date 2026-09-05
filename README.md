# EchoScribe — On-Device Speech to Text

A privacy-first, on-device speech-to-text PWA. Works on phone and PC, installable on mobile, runs entirely in your browser. A lightweight alternative to WhisperFlow.

## Features

- **Two transcription engines:**
  - **Live mode** — Real-time transcription using the Web Speech API (low latency, continuous dictation)
  - **Whisper mode** — OpenAI's Whisper model running entirely in-browser via WebAssembly (transformers.js). Works offline after first model download.
- **100% on-device** — No audio leaves your device. No cloud servers, no tracking.
- **PWA — installable on phone** — Add to home screen on Android/iOS, works like a native app
- **Offline support** — App shell cached by service worker; Whisper model cached after first download
- **20+ languages** — English (US/UK/India), Hindi, Bengali, Tamil, Telugu, Marathi, Gujarati, Kannada, Malayalam, Punjabi, Urdu, Spanish, French, German, Japanese, Chinese, Arabic, Portuguese, Russian
- **Auto-punctuation** — Optional smart punctuation
- **Copy / Download / Edit** — Export transcripts as .txt, copy to clipboard, or edit inline
- **Session stats** — Duration, word count, character count
- **Responsive** — Works on phone, tablet, and desktop

## Quick Start

### Option 1: Use directly
1. Open `index.html` in Chrome/Edge (for Web Speech API support)
2. Allow microphone access
3. Tap the mic button and start speaking

### Option 2: Install as PWA
1. Open the app in a mobile browser (Chrome on Android, Safari on iOS)
2. Use browser menu → "Add to Home Screen" / "Install App"
3. Launch from home screen — works fullscreen like a native app

### Option 3: Host it
```bash
# Any static file server works
npx serve .
# or
python3 -m http.server 8000
```

## How It Works

### Live Mode (Web Speech API)
Uses the browser's built-in `SpeechRecognition` API. On Chrome/Edge, this may use Google's servers for recognition (browser-dependent). On some platforms (e.g., Chrome on Android with on-device speech), it runs locally.

### Whisper Mode (transformers.js)
Loads OpenAI's Whisper model in your browser using [transformers.js](https://github.com/xenova/transformers.js) (WebAssembly). The model downloads once, then is cached by the browser for offline use. Audio is recorded via `MediaRecorder`, decoded, and passed through the Whisper pipeline — all in-browser, nothing sent to any server.

**Model sizes:**

| Model | Size | Speed | Accuracy |
|-------|------|-------|----------|
| Tiny  | ~40MB | Fastest | Lower |
| Base  | ~80MB | Balanced | Good |
| Small | ~250MB | Slower | Higher |

## Browser Support

| Feature | Chrome/Edge | Safari | Firefox |
|---------|------------|--------|----------|
| Live mode (Web Speech) | Yes | Yes (iOS 14.5+) | No |
| Whisper mode (WASM) | Yes | Yes | Yes |
| PWA install | Yes Android | Yes iOS (Add to Home Screen) | Limited |
| Offline | Yes | Yes | Yes |

## Project Structure

```
echo-scribe/
├── index.html       # Main app HTML
├── styles.css       # Dark theme responsive styles
├── app.js           # App logic — both engines, PWA, UI
├── manifest.json    # PWA manifest
├── sw.js            # Service worker (offline caching)
├── icons/           # App icons (SVG + PNG 192/512)
└── README.md
```

## Privacy

- **No backend.** The app is a static site — there is no server.
- **No analytics.** Zero tracking, zero telemetry.
- **Audio stays local.** In Whisper mode, audio is processed entirely in-browser. In Live mode, the browser's Speech API handles audio (Chrome may send to Google servers — use Whisper mode for guaranteed on-device processing).

## License

MIT
