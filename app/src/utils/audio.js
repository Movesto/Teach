// When getUserMedia is called, browsers switch the audio system into
// "recording" mode, which can reroute output to the earpiece/speakerphone.
// This doesn't automatically restore after the mic is released.
//
// Fix strategy (applied together for full cross-browser coverage):
//   1. Silent WAV playback  — resets the audio session on iOS (Safari + Chrome)
//   2. AudioContext close   — forces Chrome (Android/desktop) to release the
//                             audio hardware and re-evaluate output routing
//
// Both are fire-and-forget and safe to call on every browser.

const SILENT_WAV = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA';

export function releaseAudioSession() {
  // 1. iOS: play silent audio to reset AVAudioSession routing
  const silent = new Audio(SILENT_WAV);
  silent.volume = 0;
  silent.play().catch(() => {});

  // 2. Chrome: create and immediately close an AudioContext to release
  //    the audio hardware and restore normal output routing
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    ctx.close();
  } catch { /* AudioContext not supported — ignore */ }
}
