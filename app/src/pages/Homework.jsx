import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, BookMarked, Clock, CheckCircle, Eye, EyeOff } from 'lucide-react';
import { apiFetch } from '../utils/api';
import WritingFeedback from '../components/WritingFeedback';

export default function Homework() {
  const navigate = useNavigate();
  const [items, setItems] = useState(null);

  const load = () => {
    apiFetch('/api/practice/homework')
      .then(r => (r.ok ? r.json() : { homework: [] }))
      .then(d => setItems(d.homework || []))
      .catch(() => setItems([]));
  };
  useEffect(load, []);

  if (!items) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" /></div>;
  }

  const pending = items.filter(h => !h.completed_at);
  const done = items.filter(h => h.completed_at);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/dashboard')} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
          <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        <p className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-1.5"><BookMarked className="w-4 h-4" /> Homework</p>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {items.length === 0 && (
          <div className="text-center text-gray-500 dark:text-gray-400 py-16">
            <p className="mb-2">No homework yet.</p>
            <p className="text-sm">Open a lesson&rsquo;s writing task and tap &ldquo;Assign as homework&rdquo; to save it here for tomorrow.</p>
          </div>
        )}

        {pending.length > 0 && (
          <>
            <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">To do</h2>
            <div className="space-y-4 mb-8">
              {pending.map(hw => <HomeworkCard key={hw.id} hw={hw} onDone={load} />)}
            </div>
          </>
        )}

        {done.length > 0 && (
          <>
            <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Completed</h2>
            <div className="space-y-3">
              {done.map(hw => (
                <div key={hw.id} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-green-600 dark:text-green-400 mb-1">
                    <CheckCircle className="w-4 h-4" /> Done
                  </p>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{hw.title || hw.task.slice(0, 80)}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function HomeworkCard({ hw, onDone }) {
  const [text, setText] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [model, setModel] = useState(null);
  const [showModel, setShowModel] = useState(false);
  const words = text.trim().split(/\s+/).filter(Boolean).length;

  const submit = async () => {
    try {
      const res = await apiFetch(`/api/practice/homework/${hw.id}/submit`, {
        method: 'POST',
        body: JSON.stringify({ submission: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setModel(data.model_answer || '');
        setSubmitted(true);
        onDone?.();
      }
    } catch { /* ignore */ }
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-5">
      <div className="flex items-center justify-between mb-2">
        {hw.title && <p className="font-semibold text-gray-900 dark:text-white">{hw.title}</p>}
        <span className={`flex items-center gap-1 text-xs font-medium ${hw.overdue ? 'text-red-500' : 'text-gray-400 dark:text-gray-500'}`}>
          <Clock className="w-3.5 h-3.5" /> {hw.overdue ? 'Overdue' : 'Due tomorrow'}
        </span>
      </div>
      <p className="text-sm text-gray-700 dark:text-gray-300 mb-3 whitespace-pre-wrap">{hw.task}</p>

      {!submitted ? (
        <>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Write your answer here…"
            rows={7}
            className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 resize-none mb-1"
          />
          <p className="text-xs text-gray-400 dark:text-gray-500 mb-3">
            {words} words{hw.min_words ? ` · aim for ${hw.min_words}+` : ''}
          </p>
          <WritingFeedback text={text} prompt={hw.task} />
          <button
            onClick={submit}
            disabled={words < 3}
            className="w-full mt-4 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50"
          >
            Submit &amp; self-check
          </button>
        </>
      ) : (
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-green-600 dark:text-green-400 mb-3">
            <CheckCircle className="w-4 h-4" /> Submitted. Now compare with the model answer.
          </p>
          {model ? (
            <>
              <button onClick={() => setShowModel(s => !s)}
                className="flex items-center gap-2 text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 mb-2">
                {showModel ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {showModel ? 'Hide model answer' : 'Show model answer'}
              </button>
              {showModel && (
                <div className="bg-gray-50 dark:bg-gray-800 border-l-4 border-indigo-400 dark:border-indigo-600 rounded-r-xl p-4 text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                  {model}
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">No model answer for this task — re-read your writing and check it against the lesson.</p>
          )}
        </div>
      )}
    </div>
  );
}
