import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Check, X, BookMarked } from 'lucide-react';
import { apiFetch } from '../utils/api';

export default function MistakeNotebook() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    apiFetch('/api/practice/mistakes')
      .then(r => (r.ok ? r.json() : { mistakes: [], mastered: 0 }))
      .then(d => { if (!cancelled) { setData(d); setIdx(0); setRevealed(false); } })
      .catch(() => { if (!cancelled) setData({ mistakes: [], mastered: 0 }); });
    return () => { cancelled = true; };
  }, [reloadKey]);

  if (!data) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" /></div>;
  }

  const mistakes = data.mistakes;
  const m = mistakes[idx];

  const review = async (knew) => {
    if (!m || busy) return;
    setBusy(true);
    try { await apiFetch(`/api/practice/mistakes/${m.id}/review`, { method: 'POST', body: JSON.stringify({ knew }) }); } catch { /* ignore */ }
    setBusy(false);
    setRevealed(false);
    if (idx + 1 >= mistakes.length) setReloadKey(k => k + 1);   // refresh (mastered ones drop off)
    else setIdx(i => i + 1);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/dashboard')} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
          <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        <div className="flex-1">
          <p className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-1.5"><BookMarked className="w-4 h-4" /> Mistake Notebook</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {mistakes.length ? `${idx + 1} of ${mistakes.length} to review` : 'All caught up'} · {data.mastered} mastered
          </p>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8">
        {mistakes.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-5xl mb-3">🎉</div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Nothing to review</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Wrong quiz answers show up here so you can master them. You have {data.mastered} mastered.</p>
            <button onClick={() => navigate('/dashboard')} className="px-6 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Back to Dashboard</button>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6">
            <p className="text-xs text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Question</p>
            <p className="text-lg font-medium text-gray-900 dark:text-white mb-6">{m.question}</p>

            {!revealed ? (
              <button onClick={() => setRevealed(true)} className="w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700">
                Show answer
              </button>
            ) : (
              <>
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-3 mb-2">
                  <p className="text-xs text-green-700 dark:text-green-400 mb-0.5">Correct answer</p>
                  <p className="text-green-900 dark:text-green-200 font-medium">{m.correct_answer || '—'}</p>
                </div>
                {m.your_answer && (
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-5">You answered: <span className="line-through">{m.your_answer}</span></p>
                )}
                <div className="flex gap-3">
                  <button onClick={() => review(false)} disabled={busy} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-100 font-medium text-sm disabled:opacity-50">
                    <X className="w-4 h-4" /> Still learning
                  </button>
                  <button onClick={() => review(true)} disabled={busy} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800 hover:bg-green-100 font-medium text-sm disabled:opacity-50">
                    <Check className="w-4 h-4" /> Got it
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
