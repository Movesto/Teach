import { useState } from 'react';
import { CalendarPlus, Check } from 'lucide-react';
import { apiFetch } from '../utils/api';

/**
 * Assigns a lesson's writing task to the learner as homework, due tomorrow.
 * Shows up in the Homework page (/homework) for self-checking on return.
 */
export default function AssignHomeworkButton({ lessonId, title, task, modelAnswer, minWords }) {
  const [state, setState] = useState('idle'); // idle | saving | done | error

  const assign = async () => {
    if (state === 'saving' || state === 'done') return;
    setState('saving');
    try {
      const res = await apiFetch('/api/practice/homework', {
        method: 'POST',
        body: JSON.stringify({
          lesson_id: lessonId,
          title: title || '',
          task,
          model_answer: modelAnswer || '',
          min_words: minWords || 0,
        }),
      });
      setState(res.ok ? 'done' : 'error');
    } catch {
      setState('error');
    }
  };

  if (state === 'done') {
    return (
      <p className="flex items-center gap-2 text-sm font-semibold text-green-600 dark:text-green-400 mb-4">
        <Check className="w-4 h-4" /> Added to your homework — due tomorrow.
      </p>
    );
  }

  return (
    <button
      onClick={assign}
      disabled={state === 'saving' || !task}
      className="flex items-center gap-2 text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 border border-indigo-200 dark:border-indigo-800 rounded-lg px-3 py-1.5 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors mb-4 disabled:opacity-60"
    >
      <CalendarPlus className="w-4 h-4" />
      {state === 'saving' ? 'Saving…' : state === 'error' ? 'Try again' : 'Assign as homework'}
    </button>
  );
}
