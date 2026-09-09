import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ChevronLeft, CalendarCheck, Repeat, CheckCircle } from 'lucide-react';
import { apiFetch } from '../utils/api';

export default function WeeklyReview() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [started, setStarted] = useState(false);
  const [idx, setIdx] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);

  useEffect(() => {
    apiFetch('/api/practice/weekly-review')
      .then(r => (r.ok ? r.json() : { mistakes: [], due_vocab: 0 }))
      .then(setData)
      .catch(() => setData({ mistakes: [], due_vocab: 0 }));
  }, []);

  if (!data) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" /></div>;
  }

  const mistakes = data.mistakes || [];
  const current = mistakes[idx];

  const grade = async (knew) => {
    if (current) {
      apiFetch(`/api/practice/mistakes/${current.id}/review`, {
        method: 'POST', body: JSON.stringify({ knew }),
      }).catch(() => {});
    }
    setShowAnswer(false);
    setIdx(i => i + 1);
  };

  const mistakesDone = started && idx >= mistakes.length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/dashboard')} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
          <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        <p className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-1.5"><CalendarCheck className="w-4 h-4" /> Weekly review</p>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8">
        {/* Intro / summary */}
        {!started && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6 text-center">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">This week&rsquo;s catch-up</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">A short session built from what you got wrong and what&rsquo;s due to review.</p>
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4">
                <p className="text-2xl font-bold text-red-500">{mistakes.length}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">mistakes to fix</p>
              </div>
              <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-4">
                <p className="text-2xl font-bold text-indigo-500">{data.due_vocab}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">words due</p>
              </div>
            </div>
            {mistakes.length > 0 ? (
              <button onClick={() => setStarted(true)} className="w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700">
                Start review
              </button>
            ) : data.due_vocab > 0 ? (
              <Link to="/vocabulary" className="block w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700">
                Review {data.due_vocab} words →
              </Link>
            ) : (
              <p className="text-sm text-green-600 dark:text-green-400 font-medium">You&rsquo;re all caught up. Nice work!</p>
            )}
          </div>
        )}

        {/* Mistake flashcards */}
        {started && !mistakesDone && current && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6">
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4 text-center">Mistake {idx + 1} of {mistakes.length}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Question</p>
            <p className="text-lg font-medium text-gray-900 dark:text-white mb-4">{current.question}</p>
            {current.your_answer && (
              <p className="text-sm text-red-500 mb-4">You answered: {current.your_answer}</p>
            )}
            {!showAnswer ? (
              <button onClick={() => setShowAnswer(true)} className="w-full py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-lg font-semibold hover:bg-gray-200 dark:hover:bg-gray-700">
                Show answer
              </button>
            ) : (
              <>
                <div className="bg-green-50 dark:bg-green-900/20 border-l-4 border-green-400 rounded-r-xl p-4 mb-5">
                  <p className="text-xs font-semibold text-green-700 dark:text-green-400 mb-1">Correct answer</p>
                  <p className="text-sm text-gray-800 dark:text-gray-200">{current.correct_answer || '—'}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => grade(false)} className="py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-lg font-semibold hover:bg-gray-200 dark:hover:bg-gray-700">
                    Still tricky
                  </button>
                  <button onClick={() => grade(true)} className="py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700">
                    Got it
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* After mistakes: hand off to vocab */}
        {mistakesDone && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Mistakes reviewed!</h2>
            {data.due_vocab > 0 ? (
              <>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">Finish the session with your {data.due_vocab} due words.</p>
                <Link to="/vocabulary" className="inline-flex items-center gap-2 px-5 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700">
                  <Repeat className="w-4 h-4" /> Review vocabulary →
                </Link>
              </>
            ) : (
              <p className="text-sm text-green-600 dark:text-green-400 font-medium">No words due — you&rsquo;re fully caught up!</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
