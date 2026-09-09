import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Globe, ExternalLink, BookOpen, Headphones, Trophy } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';
import WritingFeedback from '../components/WritingFeedback';

const LEVELS = ['B1', 'B2', 'C1'];

export default function Authentic() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [level, setLevel] = useState(LEVELS.includes(user?.cefr_level) ? user.cefr_level : 'B1');
  const [assignments, setAssignments] = useState(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch(`/api/practice/authentic?level=${level}`)
      .then(r => (r.ok ? r.json() : { assignments: [] }))
      .then(d => { if (!cancelled) setAssignments(d.assignments || []); })
      .catch(() => { if (!cancelled) setAssignments([]); });
    return () => { cancelled = true; };
  }, [level]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/dashboard')} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
          <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        <p className="flex-1 font-bold text-gray-900 dark:text-white text-sm flex items-center gap-1.5"><Globe className="w-4 h-4" /> Real-world English</p>
        <div className="flex gap-1">
          {LEVELS.map(l => (
            <button key={l} onClick={() => setLevel(l)} className={`px-2.5 py-1 rounded-lg text-xs font-medium ${level === l ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>{l}</button>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-2xl p-5 mb-6">
          <p className="flex items-center gap-2 font-semibold mb-1"><Trophy className="w-5 h-5" /> You&rsquo;re ready for the real thing</p>
          <p className="text-emerald-50 text-sm">These are genuine articles, talks, and books — not made for learners. Use the tasks to work through them.</p>
        </div>

        {!assignments ? (
          <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" /></div>
        ) : assignments.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-16">No assignments for this level yet.</p>
        ) : (
          <div className="space-y-5">
            {assignments.map(a => <AssignmentCard key={a.id} a={a} />)}
          </div>
        )}
      </div>
    </div>
  );
}

function AssignmentCard({ a }) {
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState('');
  const Icon = a.type === 'listen' ? Headphones : BookOpen;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-5">
      <div className="flex items-start gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 dark:text-white">{a.title}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{a.source}{a.duration ? ` · ${a.duration}` : ''}</p>
        </div>
      </div>

      {a.intro && <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">{a.intro}</p>}

      <a href={a.url} target="_blank" rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 mb-4">
        <ExternalLink className="w-4 h-4" /> Open the {a.type === 'listen' ? 'video/audio' : 'text'}
      </a>

      <button onClick={() => setOpen(o => !o)}
        className="block text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 mb-2">
        {open ? 'Hide tasks' : 'Show tasks'}
      </button>

      {open && (
        <div className="space-y-4 mt-2">
          {a.comprehension?.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Comprehension</p>
              <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
                {a.comprehension.map((q, i) => <li key={i}>{q}</li>)}
              </ol>
            </div>
          )}
          {a.vocab_task && (
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Vocabulary</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{a.vocab_task}</p>
            </div>
          )}
          {a.summary_task && (
            <div>
              <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Summary {a.min_words ? `(${a.min_words}+ words)` : ''}</p>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">{a.summary_task}</p>
              <textarea
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                placeholder="Write your summary here…"
                rows={6}
                className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 resize-none"
              />
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                {answer.trim().split(/\s+/).filter(Boolean).length} words
              </p>
              <WritingFeedback text={answer} prompt={a.summary_task} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
