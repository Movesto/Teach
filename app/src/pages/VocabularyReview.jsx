import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, RotateCcw, Check, X, BookOpen, Star } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const MASTERY_LABELS = ['New', 'Learning', 'Familiar', 'Good', 'Strong', 'Mastered'];
const MASTERY_COLORS = [
  'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400',
  'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
  'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
  'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
  'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
];

export default function VocabularyReview() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [words, setWords] = useState([]);
  const [totalWords, setTotalWords] = useState(0);
  const [current, setCurrent] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [results, setResults] = useState([]);   // {word, knew}
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/vocabulary/due', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => {
        setWords(data.words);
        setTotalWords(data.total_words);
        setLoading(false);
      })
      .catch(() => { setError('Could not load vocabulary.'); setLoading(false); });
  }, [token]);

  const submitResult = async (knew) => {
    if (submitting) return;
    const word = words[current];
    setSubmitting(true);
    setResults(prev => [...prev, { word: word.word, knew }]);

    try {
      await fetch('/api/vocabulary/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ word_id: word.id, knew }),
      });
    } catch {
      // Non-fatal — result is tracked locally even if server call fails
    }

    if (current + 1 >= words.length) {
      setDone(true);
    } else {
      setCurrent(c => c + 1);
      setFlipped(false);
    }
    setSubmitting(false);
  };

  const knew = () => submitResult(true);
  const didntKnow = () => submitResult(false);
  const knewCount = results.filter(r => r.knew).length;

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center gap-4">
        <p className="text-red-500">{error}</p>
        <button onClick={() => navigate('/dashboard')} className="text-indigo-600 hover:underline text-sm">
          Back to Dashboard
        </button>
      </div>
    );
  }

  // No words due
  if (words.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <p className="font-bold text-gray-900 dark:text-white">Vocabulary Review</p>
        </div>
        <div className="max-w-lg mx-auto px-4 py-16 text-center">
          <div className="text-5xl mb-4">🎉</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">All caught up!</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-2">
            No words are due for review right now.
          </p>
          {totalWords === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Complete some lessons to add words to your vocabulary list.
            </p>
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500">
              You have {totalWords} word{totalWords !== 1 ? 's' : ''} in your list. Check back later.
            </p>
          )}
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-6 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Session complete
  if (done) {
    const pct = Math.round((knewCount / results.length) * 100);
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate('/dashboard')} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
          </button>
          <p className="font-bold text-gray-900 dark:text-white">Vocabulary Review</p>
        </div>
        <div className="max-w-lg mx-auto px-4 py-12 text-center">
          <div className="text-5xl mb-4">{pct >= 80 ? '🌟' : pct >= 50 ? '👍' : '💪'}</div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Session complete</h2>
          <p className="text-gray-500 dark:text-gray-400 mb-6">
            {knewCount} of {results.length} words — {pct}%
          </p>

          {/* Score bar */}
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-8">
            <div
              className="h-3 rounded-full bg-green-500 transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>

          {/* Word results */}
          <div className="text-left space-y-2 mb-8 max-h-64 overflow-y-auto">
            {results.map((r, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-white dark:bg-gray-900">
                {r.knew
                  ? <Check className="w-4 h-4 text-green-500 shrink-0" />
                  : <X className="w-4 h-4 text-red-400 shrink-0" />
                }
                <span className="text-sm text-gray-700 dark:text-gray-300">{r.word}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-3 justify-center">
            <button
              onClick={() => navigate('/vocabulary')}
              className="flex items-center gap-2 px-5 py-2.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 text-sm font-medium"
            >
              <RotateCcw className="w-4 h-4" /> Review again
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const word = words[current];
  const progress = ((current) / words.length) * 100;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/dashboard')} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
          <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        <div className="flex-1">
          <p className="font-bold text-gray-900 dark:text-white text-sm">Vocabulary Review</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{current + 1} of {words.length} due today</p>
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
          <BookOpen className="w-3.5 h-3.5" />
          {totalWords} total
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-200 dark:bg-gray-800">
        <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${progress}%` }} />
      </div>

      {/* Card area */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">
          {/* Mastery badge */}
          <div className="flex justify-center mb-4">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${MASTERY_COLORS[word.mastery_level] || MASTERY_COLORS[0]}`}>
              {MASTERY_LABELS[word.mastery_level] || 'New'}
              {word.review_count > 0 && ` · reviewed ${word.review_count}×`}
            </span>
          </div>

          {/* Flashcard */}
          <button
            onClick={() => setFlipped(f => !f)}
            className="w-full min-h-48 bg-white dark:bg-gray-900 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center p-8 text-center cursor-pointer hover:shadow-lg transition-shadow active:scale-[0.98]"
          >
            {!flipped ? (
              <>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-3 uppercase tracking-wider">English</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white leading-snug">{word.word}</p>
                <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-4">Tap to see Somali</p>
              </>
            ) : (
              <>
                <p className="text-xs text-gray-400 dark:text-gray-500 mb-3 uppercase tracking-wider">Somali</p>
                <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 leading-snug">
                  {word.translation || '—'}
                </p>
                <p className="text-sm text-gray-400 dark:text-gray-500 mt-3">{word.word}</p>
              </>
            )}
          </button>

          {/* Prompt */}
          {!flipped && (
            <p className="text-center text-sm text-gray-400 dark:text-gray-500 mt-4">
              Do you know this in Somali? Tap the card to check.
            </p>
          )}

          {/* Action buttons — only show after flip */}
          {flipped && (
            <div className="flex gap-3 mt-6">
              <button
                onClick={didntKnow}
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-100 dark:hover:bg-red-900/40 font-medium text-sm disabled:opacity-50 transition-colors"
              >
                <X className="w-4 h-4" /> Didn't know
              </button>
              <button
                onClick={knew}
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800 hover:bg-green-100 dark:hover:bg-green-900/40 font-medium text-sm disabled:opacity-50 transition-colors"
              >
                <Check className="w-4 h-4" /> Got it
              </button>
            </div>
          )}

          {/* Stars for mastery */}
          <div className="flex justify-center gap-1 mt-6">
            {[0, 1, 2, 3, 4].map(i => (
              <Star
                key={i}
                className={`w-4 h-4 ${i < word.mastery_level ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300 dark:text-gray-600'}`}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
