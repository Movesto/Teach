// Service-worker registration + update detection for the PWA.
// registerSW(onUpdate) registers /sw.js and calls onUpdate(registration) when a
// new version has installed and is waiting. applyUpdate(reg) tells that waiting
// worker to take over; the page reloads once it does (controllerchange).

export function registerSW(onUpdate) {
  if (!('serviceWorker' in navigator)) return;

  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  const doRegister = async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');

      // A worker was already waiting from a previous visit.
      if (reg.waiting && navigator.serviceWorker.controller) onUpdate?.(reg);

      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', () => {
          // installed + an existing controller ⇒ this is an update, not first install
          if (nw.state === 'installed' && navigator.serviceWorker.controller) onUpdate?.(reg);
        });
      });
    } catch {
      /* SW registration is best-effort; the app still works without it */
    }
  };

  // main.jsx may run after 'load' has already fired (module scripts are deferred),
  // so register immediately in that case rather than waiting for an event that passed.
  if (document.readyState === 'complete') doRegister();
  else window.addEventListener('load', doRegister, { once: true });
}

export function applyUpdate(reg) {
  reg?.waiting?.postMessage({ type: 'SKIP_WAITING' });
}
