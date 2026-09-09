import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Printer, BookOpen, Target, Flame, Star, CheckCircle2, TrendingUp, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';

function Stat({ icon, label, value, sub }) {
  const Icon = icon;
  return (
    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
        <Icon className="w-4 h-4" />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function ReportCard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [d, setD] = useState({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      apiFetch('/api/progress/stats').then(r => (r.ok ? r.json() : null)).catch(() => null),
      apiFetch('/api/vocabulary/coverage').then(r => (r.ok ? r.json() : null)).catch(() => null),
      apiFetch('/api/placement/history').then(r => (r.ok ? r.json() : null)).catch(() => null),
      apiFetch('/api/practice/mistakes').then(r => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([stats, coverage, history, mistakes]) => {
      if (!cancelled) { setD({ stats, coverage, history, mistakes }); setLoaded(true); }
    });
    return () => { cancelled = true; };
  }, []);

  if (!loaded) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" /></div>;
  }

  const stats = d.stats || {};
  const attempts = d.history?.attempts || [];
  const first = attempts[0];
  const latest = attempts[attempts.length - 1];
  const cov = d.coverage || {};
  const mins = stats.total_minutes || 0;
  const timeStr = mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
  const readerChapters = cov.reader_chapters_read || 0;
  const today = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <style>{`@media print { nav, .no-print { display:none !important; } body { background:#fff !important; } }`}</style>

      <div className="no-print bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/progress')} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
          <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        <p className="font-bold text-gray-900 dark:text-white text-sm flex-1">Progress Report</p>
        <button onClick={() => window.print()} className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium">
          <Printer className="w-4 h-4" /> Print / Save PDF
        </button>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 sm:p-8">
          <div className="text-center mb-6">
            <p className="text-xs uppercase tracking-[0.2em] text-indigo-600 font-semibold">Barashada Ingiriisiga</p>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-1">Progress Report</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{user?.name || 'Learner'} · {today}</p>
          </div>

          {/* Level line */}
          <div className="rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 p-4 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">English level</span>
            </div>
            <div className="flex items-center gap-2">
              {first && attempts.length >= 2 && <span className="text-gray-400 dark:text-gray-500 font-semibold">{first.cefr} →</span>}
              <span className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">{latest?.cefr || user?.cefr_level || 'A1'}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Stat icon={Target} label="Words toward C1" value={(cov.learned ?? 0).toLocaleString()} sub={`of ~${(cov.target_total ?? 3807).toLocaleString()}`} />
            <Stat icon={BookOpen} label="Lessons completed" value={stats.lessons_completed ?? 0} />
            <Stat icon={BookOpen} label="Reader chapters read" value={readerChapters} />
            <Stat icon={Star} label="Average quiz score" value={stats.avg_score > 0 ? `${stats.avg_score}%` : '—'} />
            <Stat icon={Flame} label="Day streak" value={stats.streak_days ?? 0} />
            <Stat icon={Clock} label="Time studied" value={timeStr} />
            <Stat icon={CheckCircle2} label="Vocabulary mastered" value={stats.words_mastered ?? 0} sub={`${stats.words_learning ?? 0} learning`} />
            <Stat icon={CheckCircle2} label="Mistakes fixed" value={d.mistakes?.mastered ?? 0} sub={`${d.mistakes?.mistakes?.length ?? 0} to review`} />
          </div>

          <p className="text-center text-xs text-gray-400 dark:text-gray-500 mt-6">
            Keep going — a little practice every day is how you reach C1.
          </p>
        </div>
      </div>
    </div>
  );
}
