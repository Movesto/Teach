import { useEffect, useState } from 'react';
import { Download, RefreshCw, WifiOff, Share, X } from 'lucide-react';
import { registerSW, applyUpdate } from '../utils/pwa';

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent || '');
const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;

/**
 * PWA affordances: an "Install app" button (Android/Chrome beforeinstallprompt),
 * an iOS "Add to Home Screen" hint, a "new version — refresh" prompt when the
 * service worker updates, and an offline indicator. Mounted once at the app root.
 */
export default function PwaPrompts() {
  const [deferred, setDeferred] = useState(null);   // beforeinstallprompt event
  const [showInstall, setShowInstall] = useState(false);
  const [showIosHint, setShowIosHint] = useState(() => {
    // iOS Safari never fires beforeinstallprompt — show a one-time manual hint.
    if (!isIos() || isStandalone()) return false;
    try { return !localStorage.getItem('iosHintDismissed'); } catch { return true; }
  });
  const [updateReg, setUpdateReg] = useState(null);
  const [offline, setOffline] = useState(typeof navigator !== 'undefined' && !navigator.onLine);

  useEffect(() => {
    registerSW((reg) => setUpdateReg(reg));

    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferred(e);
      try { if (!localStorage.getItem('installDismissed')) setShowInstall(true); } catch { setShowInstall(true); }
    };
    const onInstalled = () => { setShowInstall(false); setDeferred(null); };
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  const install = async () => {
    if (!deferred) return;
    deferred.prompt();
    try { await deferred.userChoice; } catch { /* ignore */ }
    setDeferred(null);
    setShowInstall(false);
  };

  const dismissInstall = () => {
    setShowInstall(false);
    try { localStorage.setItem('installDismissed', '1'); } catch { /* ignore */ }
  };
  const dismissIosHint = () => {
    setShowIosHint(false);
    try { localStorage.setItem('iosHintDismissed', '1'); } catch { /* ignore */ }
  };

  const barBase =
    'fixed inset-x-0 z-50 mx-auto max-w-md px-4 py-3 flex items-center gap-3 shadow-lg text-sm';

  return (
    <>
      {/* Offline indicator — top, unobtrusive */}
      {offline && (
        <div className={`${barBase} top-0 rounded-b-xl bg-gray-800 text-gray-100`}>
          <WifiOff className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">You&rsquo;re offline. You can keep reading, but practice and the tutor need internet.</span>
        </div>
      )}

      {/* Update available — bottom, highest priority action */}
      {updateReg && (
        <div className={`${barBase} bottom-4 rounded-xl bg-indigo-600 text-white`}>
          <RefreshCw className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">A new version is ready.</span>
          <button
            onClick={() => applyUpdate(updateReg)}
            className="px-3 py-1 rounded-lg bg-white text-indigo-700 font-semibold hover:bg-indigo-50"
          >
            Refresh
          </button>
        </div>
      )}

      {/* Android/Chrome install button */}
      {showInstall && !updateReg && (
        <div className={`${barBase} bottom-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100`}>
          <Download className="w-5 h-5 flex-shrink-0 text-indigo-600 dark:text-indigo-400" />
          <span className="flex-1">Install Barashada for faster access and offline reading.</span>
          <button onClick={install} className="px-3 py-1 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700">
            Install
          </button>
          <button onClick={dismissInstall} aria-label="Dismiss" className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* iOS manual add-to-home-screen hint */}
      {showIosHint && !updateReg && (
        <div className={`${barBase} bottom-4 rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100`}>
          <Share className="w-5 h-5 flex-shrink-0 text-indigo-600 dark:text-indigo-400" />
          <span className="flex-1">
            Install this app: tap the Share button, then &ldquo;Add to Home Screen&rdquo;.
          </span>
          <button onClick={dismissIosHint} aria-label="Dismiss" className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </>
  );
}
