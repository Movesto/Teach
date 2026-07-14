import { STRINGS } from '../utils/strings';

// Shared load-error panel: bilingual, offline-aware, with a retry action.
export default function ErrorBox({ title, onRetry, fullScreen = true }) {
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  const heading = offline ? STRINGS.offline : (title ? { en: title, so: '' } : STRINGS.loadFailed);

  const body = (
    <div className="text-center max-w-sm px-4 mx-auto">
      <p className="text-lg font-semibold text-gray-800 dark:text-white mb-1">{heading.en}</p>
      {heading.so && <p className="text-indigo-500 text-sm font-medium mb-2">{heading.so}</p>}
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">{STRINGS.checkConnection.en}</p>
      <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">{STRINGS.checkConnection.so}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-5 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
        >
          {STRINGS.retry.en} / {STRINGS.retry.so}
        </button>
      )}
    </div>
  );

  if (!fullScreen) return <div className="py-10">{body}</div>;
  return <div className="flex items-center justify-center min-h-screen dark:bg-gray-950">{body}</div>;
}
