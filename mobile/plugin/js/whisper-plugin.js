// JS wrapper for Capacitor Whisper plugin — call from your web code
// Usage:
// import { transcribeFile } from './mobile/plugin/js/whisper-plugin'
// const res = await transcribeFile('/path/to/audio.webm')

import { Plugins } from '@capacitor/core';
const { WhisperPlugin } = (Plugins as any);

export async function transcribeFile(path: string) {
  if (!WhisperPlugin) throw new Error('WhisperPlugin not available');
  const r = await WhisperPlugin.transcribeFile({ path });
  return r;
}

export async function transcribeBuffer(base64: string) {
  if (!WhisperPlugin) throw new Error('WhisperPlugin not available');
  const r = await WhisperPlugin.transcribeBuffer({ base64 });
  return r;
}
