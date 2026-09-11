// Download readers (text + audio) into the Cache API for offline use. The service
// worker serves /api and /audio from this cache when the network is unavailable.
// A small manifest in localStorage tracks what's downloaded for UI state.

const OFFLINE_CACHE = 'barashada-offline';
const MANIFEST_KEY = 'offline_readers';

export function listOfflineReaders() {
  try { return JSON.parse(localStorage.getItem(MANIFEST_KEY) || '{}'); } catch { return {}; }
}

export function isReaderOffline(readerId) {
  return Boolean(listOfflineReaders()[readerId]);
}

function saveManifest(m) {
  try { localStorage.setItem(MANIFEST_KEY, JSON.stringify(m)); } catch { /* ignore */ }
}

function audioUrls(reader) {
  return (reader?.chapters || []).map((c) => c.audio).filter(Boolean);
}

/**
 * Download a reader (its JSON + every chapter's audio) for offline use.
 * onProgress(percent) is called as items complete. Returns true on success.
 */
export async function downloadReader(readerId, reader, onProgress) {
  if (!('caches' in window)) return false;
  const cache = await caches.open(OFFLINE_CACHE);
  const detailUrl = `/api/readers/${readerId}`;
  const audios = audioUrls(reader);
  const total = 1 + audios.length;
  let done = 0;
  const bump = () => { done += 1; onProgress?.(Math.round((done / total) * 100)); };

  // Reader JSON (not redirected — safe to cache the response directly).
  try {
    const r = await fetch(detailUrl, { credentials: 'include' });
    if (r.ok) await cache.put(detailUrl, r.clone());
  } catch { /* keep going; audio may still cache */ }
  bump();

  // Chapter audio. The listen endpoint 307-redirects to /audio/*.mp3; a redirected
  // Response can't be cache.put() directly, so re-wrap the bytes in a clean 200.
  for (const url of audios) {
    try {
      const r = await fetch(url, { credentials: 'include' });
      if (r.ok) {
        const blob = await r.blob();
        await cache.put(url, new Response(blob, {
          headers: { 'Content-Type': r.headers.get('Content-Type') || 'audio/mpeg' },
        }));
      }
    } catch { /* skip this chapter's audio */ }
    bump();
  }

  const m = listOfflineReaders();
  m[readerId] = { title: reader?.title, level: reader?.level, at: Date.now() };
  saveManifest(m);
  return true;
}

/** Remove a downloaded reader's cached content. */
export async function removeReader(readerId, reader) {
  if ('caches' in window) {
    const cache = await caches.open(OFFLINE_CACHE);
    await cache.delete(`/api/readers/${readerId}`);
    for (const url of audioUrls(reader)) await cache.delete(url);
  }
  const m = listOfflineReaders();
  delete m[readerId];
  saveManifest(m);
}
