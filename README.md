# EchoScribe

Phone-first, privacy-minded alternative to **Wispr Flow**.

Speak naturally. EchoScribe turns your voice into clean text you can copy, share, or save. It works in the browser on **Android phones**, **iPhones** (Safari / Chrome), and **laptops**.

## Why this exists

Wispr Flow is a paid dictation app that types into other apps. A web app cannot become a system keyboard on every phone without going through the App Store / Play Store. EchoScribe is the closest open-source version you can use today:

- Works on **phone and laptop** from one codebase
- Installs like an app (Add to Home Screen / PWA)
- Cleans filler words (`um`, `uh`, `you know`)
- Voice commands: `new paragraph`, `period`, `comma`, `scratch that`
- Custom spellings for names
- Saved notes on the device
- Optional **on-device Whisper** so audio stays on the phone after the first model download

## How to use on a phone

1. Open the hosted site in **Chrome (Android)** or **Safari / Chrome (iPhone)**
2. Allow the microphone
3. Tap the purple mic and talk
4. Browser menu → **Add to Home Screen** so it feels like a real app
5. Copy or Share the text into WhatsApp, Gmail, Notes, etc.

Laptop: open the same site in Chrome or Edge. Press **Space** to start/stop when you are not typing.

## Two engines

| Engine | Best for | Privacy |
|---|---|---|
| **Live** (Web Speech API) | Instant dictation | Uses the browser speech engine. Chrome may talk to Google. |
| **Whisper** (WASM) | Offline / extra privacy | Model runs in the browser. First download needs internet. Prefer **Tiny** on phones. |

No build step. No backend. No accounts.

```bash
npx serve .
# or
python3 -m http.server 8000
```

## Limits (honest)

- A PWA cannot inject text into every other app the way a native keyboard can.
- Live mode quality depends on the browser.
- Whisper Tiny is usable on phones; Small needs a strong device.
- Firefox has no Web Speech API — use Whisper there.

## License

MIT
