export async function apiFetch(url, options = {}) {
  const { headers, body, ...rest } = options;
  const res = await fetch(url, {
    ...rest,
    credentials: 'include',
    headers: {
      ...(typeof body === 'string' ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    body,
  });
  if (res.status === 401) {
    window.dispatchEvent(new Event('auth:expired'));
  }
  return res;
}
