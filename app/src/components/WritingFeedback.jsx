import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { apiFetch } from '../utils/api';

/**
 * Free AI writing feedback, once per day. Give it the learner's `text` (and an
 * optional `prompt` for context). It calls /api/practice/writing-feedback and
 * renders the tutor's notes, or a friendly message when the daily quota is used.
 */
export default function WritingFeedback({ text, prompt }) {
  const [state, setState] = useState('idle'); // idle | loading | done | limit | error
  const [feedback, setFeedback] = useState('');
  const [message, setMessage] = useState('');

  const enough = (text || '').trim().split(/\s+/).filter(Boolean).length >= 5;

  const getFeedback = async () => {
    if (state === 'loading') return;
    setState('loading');
    try {
      const res = await apiFetch('/api/practice/writing-feedback', {
        method: 'POST',
        body: JSON.stringify({ text, prompt }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setFeedback(data.feedback || '');
        setState('done');
      } else if (res.status === 429) {
        setMessage(data.detail || 'You’ve used your free writing check for today.');
        setState('limit');
      } else {
        setMessage(data.detail || 'Feedback is unavailable right now. Please try again later.');
        setState('error');
      }
    } catch {
      setMessage('Feedback is unavailable right now. Please try again later.');
      setState('error');
    }
  };

  return (
    <div className="mt-4">
      {state !== 'done' && (
        <button
          onClick={getFeedback}
          disabled={!enough || state === 'loading'}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-fuchsia-600 to-indigo-600 text-white text-sm font-semibold hover:from-fuchsia-700 hover:to-indigo-700 transition-colors disabled:opacity-50"
        >
          <Sparkles className="w-4 h-4" />
          {state === 'loading' ? 'Reading your writing…' : 'Get AI feedback (1 free/day)'}
        </button>
      )}
      {!enough && state === 'idle' && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Write a little first, then get feedback.</p>
      )}
      {(state === 'limit' || state === 'error') && (
        <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">{message}</p>
      )}
      {state === 'done' && (
        <div className="bg-fuchsia-50 dark:bg-fuchsia-900/20 border-l-4 border-fuchsia-400 dark:border-fuchsia-600 rounded-r-xl p-4 mt-2">
          <p className="flex items-center gap-2 text-xs font-semibold text-fuchsia-700 dark:text-fuchsia-300 uppercase tracking-wide mb-2">
            <Sparkles className="w-4 h-4" /> Your tutor&rsquo;s notes
          </p>
          <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{feedback}</p>
        </div>
      )}
    </div>
  );
}
