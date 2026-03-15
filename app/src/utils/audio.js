// iOS Safari switches the audio session to "voice call" mode when getUserMedia
// is called, routing sound through the earpiece even after the mic is released.
// Playing a silent audio immediately after stopping the mic tracks forces iOS
// to re-evaluate the audio route and restore headset/speaker output.
//
// This is the standard browser-side workaround — no native app needed.
const SILENT_WAV = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

export function releaseAudioSession() {
  const silent = new Audio(SILENT_WAV);
  silent.volume = 0;
  silent.play().catch(() => {});
}
