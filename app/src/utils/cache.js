// Module-level API response caches shared across pages. Kept out of the
// components so AuthContext can clear them on logout — otherwise the next
// account to sign in on this browser would see the previous user's data.
const store = new Map();

export function cacheGet(key, ttlMs = null) {
  const entry = store.get(key);
  if (!entry) return null;
  if (ttlMs !== null && Date.now() - entry.at > ttlMs) return null;
  return entry.value;
}

export function cacheSet(key, value) {
  store.set(key, { value, at: Date.now() });
}

export function clearCache() {
  store.clear();
}
