import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, BookOpen, Clock, Flame, Star, TrendingUp, Award } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const CEFR_COLORS = {
  A1: 'bg-gray-500', A2: 'bg-blue-500',
  B1: 'bg-green-500', B2: 'bg-teal-500',
  C1: 'bg-purple-500', C2: 'bg-indigo-600',
};

function StatCard({ icon: Icon, label, value, sub, color = 'indigo' }) {
  const colors = {
    indigo: 'bg-indigo-50 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400',
    green:  'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400',
    amber:  'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400',
    blue:   'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400',
  };
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${colors[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{label}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{sub}</p>}
    </div>
  );
}

function ScoreTrend({ scores }) {
  if (!scores || scores.length < 2) {
    return (
      <p className="text-sm text-gray-400 dark:text-gray-500 text-center py-4">
        Complete more lessons to see your score trend.
      </p>
    );
  }
  const max = 100;
  const h = 80;
  const w = 100 / (scores.length - 1);

  return (
    <div className="relative" style={{ height: h + 24 }}>
      {/* Grid lines */}
      {[0, 25, 50, 75, 100].map(v => (
        <div
          key={v}
          className="absolute w-full border-t border-gray-100 dark:border-gray-800"
          style={{ bottom: (v / max) * h + 12 }}
        >
          <span className="absolute -left-1 -translate-x-full text-xs text-gray-300 dark:text-gray-600 select-none">{v}</span>
        </div>
      ))}
      {/* Line + dots */}
      <svg className="absolute inset-0 w-full overflow-visible" style={{ height: h + 24, paddingLeft: 20 }}>
        <polyline
          points={scores.map((s, i) => {
            const x = (i / (scores.length - 1)) * 100;
            const y = h - (s / max) * h + 12;
            return `${x}%,${y}`;
          }).join(' ')}
          fill="none"
          stroke="#6366f1"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {scores.map((s, i) => {
          const y = h - (s / max) * h + 12;
          return (
            <g key={i}>
              <circle cx={`${(i / (scores.length - 1)) * 100}%`} cy={y} r="4" fill="#6366f1" />
              <text
                x={`${(i / (scores.length - 1)) * 100}%`}
                y={y - 8}
                textAnchor="middle"
                className="fill-gray-500 dark:fill-gray-400"
                fontSize="10"
              >
                {s}%
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function VocabBar({ learning, mastered }) {
  const total = Math.max(learning, 1);
  const masteredPct = Math.round((mastered / total) * 100);
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-gray-600 dark:text-gray-400">{mastered} mastered</span>
        <span className="text-gray-400 dark:text-gray-500">{learning} total</span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
        <div
          className="h-3 rounded-full bg-green-500 transition-all duration-700"
          style={{ width: `${masteredPct}%` }}
        />
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500">
        {masteredPct}% mastered · {learning - mastered} still learning
      </p>
    </div>
  );
}

export default function Progress() {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/api/progress/stats', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        if (r.status === 401) { window.dispatchEvent(new Event('auth:expired')); throw new Error(); }
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(data => { setStats(data); setLoading(false); })
      .catch(() => { setError('Could not load progress.'); setLoading(false); });
  }, [token]);

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
        <button onClick={() => navigate('/dashboard')} className="text-indigo-600 hover:underline text-sm">Back</button>
      </div>
    );
  }

  const cefrIdx = CEFR_LEVELS.indexOf(stats.cefr_level);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/dashboard')} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
          <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        <div>
          <p className="font-bold text-gray-900 dark:text-white text-sm">My Progress</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">Your learning journey</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

        {/* CEFR level */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg ${CEFR_COLORS[stats.cefr_level] || 'bg-gray-500'}`}>
                {stats.cefr_level}
              </div>
              <div>
                <p className="font-bold text-gray-900 dark:text-white">Current Level</p>
                <p className="text-sm text-gray-500 dark:text-gray-400">CEFR {stats.cefr_level}</p>
              </div>
            </div>
            <Award className="w-6 h-6 text-gray-300 dark:text-gray-600" />
          </div>
          {/* Level ladder */}
          <div className="flex gap-1.5">
            {CEFR_LEVELS.map((lvl, i) => (
              <div key={lvl} className="flex-1 flex flex-col items-center gap-1">
                <div className={`w-full h-2 rounded-full ${i <= cefrIdx ? (CEFR_COLORS[lvl] || 'bg-gray-400') : 'bg-gray-200 dark:bg-gray-700'}`} />
                <span className={`text-xs ${i === cefrIdx ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-600'}`}>{lvl}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            icon={BookOpen}
            label="Lessons done"
            value={stats.lessons_completed}
            color="indigo"
          />
          <StatCard
            icon={Flame}
            label="Day streak"
            value={stats.streak_days}
            sub={stats.streak_days === 1 ? '1 day in a row' : stats.streak_days > 1 ? `${stats.streak_days} days in a row` : 'Start today!'}
            color="amber"
          />
          <StatCard
            icon={Clock}
            label="Time studied"
            value={stats.total_minutes >= 60
              ? `${Math.floor(stats.total_minutes / 60)}h ${stats.total_minutes % 60}m`
              : `${stats.total_minutes}m`}
            color="blue"
          />
          <StatCard
            icon={Star}
            label="Avg quiz score"
            value={stats.avg_score > 0 ? `${stats.avg_score}%` : '—'}
            color="green"
          />
        </div>

        {/* Score trend */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-indigo-500" />
            <p className="font-semibold text-gray-900 dark:text-white text-sm">Quiz Score Trend</p>
          </div>
          <ScoreTrend scores={stats.recent_scores} />
        </div>

        {/* Vocabulary */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-green-500" />
              <p className="font-semibold text-gray-900 dark:text-white text-sm">Vocabulary</p>
            </div>
            <button
              onClick={() => navigate('/vocabulary')}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline font-medium"
            >
              Review now →
            </button>
          </div>
          {stats.words_learning > 0 ? (
            <VocabBar learning={stats.words_learning} mastered={stats.words_mastered} />
          ) : (
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Complete lessons to build your vocabulary list.
            </p>
          )}
        </div>

      </div>
    </div>
  );
}
