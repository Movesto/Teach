import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Star, MessageSquare, Filter } from 'lucide-react';
import { apiFetch } from '../utils/api';

const RATING_COLORS = [
  '', 'text-red-500', 'text-orange-500', 'text-yellow-500', 'text-blue-500', 'text-green-500',
];
const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];

function StarDisplay({ rating }) {
  return (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <Star
          key={n}
          className={`w-3.5 h-3.5 ${n <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300 dark:text-gray-600'}`}
        />
      ))}
    </span>
  );
}

function fmt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function AdminFeedback() {
  const navigate = useNavigate();
  const [feedback, setFeedback] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterRating, setFilterRating] = useState(0);
  const [filterPage, setFilterPage] = useState('');

  useEffect(() => {
    apiFetch('/api/admin/feedback')
      .then(r => {
        if (r.status === 403) throw new Error('forbidden');
        if (!r.ok) throw new Error('error');
        return r.json();
      })
      .then(data => { setFeedback(data.feedback); setTotal(data.total); setLoading(false); })
      .catch(err => {
        setError(err.message === 'forbidden' ? 'Access denied.' : 'Could not load feedback.');
        setLoading(false);
      });
  }, []);

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
        <p className="text-red-500 font-medium">{error}</p>
        <button onClick={() => navigate('/dashboard')} className="text-indigo-600 hover:underline text-sm">Back to Dashboard</button>
      </div>
    );
  }

  const pages = [...new Set(feedback.map(f => f.page))].sort();
  const filtered = feedback.filter(f =>
    (filterRating === 0 || f.rating === filterRating) &&
    (!filterPage || f.page === filterPage)
  );

  const avgRating = feedback.length
    ? (feedback.reduce((s, f) => s + f.rating, 0) / feedback.length).toFixed(1)
    : '—';

  const distribution = [1, 2, 3, 4, 5].map(r => ({
    rating: r,
    count: feedback.filter(f => f.rating === r).length,
  }));

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/dashboard')} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
          <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        <div>
          <p className="font-bold text-gray-900 dark:text-white text-sm">Student Feedback</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{total} submission{total !== 1 ? 's' : ''}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 text-center">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">{total}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Total</p>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 text-center">
            <p className="text-2xl font-bold text-yellow-500">{avgRating}</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Avg Rating</p>
          </div>
          {[5, 1].map(r => (
            <div key={r} className="bg-white dark:bg-gray-900 rounded-2xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 text-center">
              <p className={`text-2xl font-bold ${RATING_COLORS[r]}`}>
                {feedback.filter(f => f.rating === r).length}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{RATING_LABELS[r]}</p>
            </div>
          ))}
        </div>

        {/* Rating distribution */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
          <p className="font-semibold text-gray-900 dark:text-white text-sm mb-4">Rating Distribution</p>
          <div className="space-y-2">
            {distribution.reverse().map(({ rating: r, count }) => {
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={r} className="flex items-center gap-3">
                  <span className="text-xs w-16 text-gray-500 dark:text-gray-400 shrink-0">{RATING_LABELS[r]}</span>
                  <div className="flex-1 h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-yellow-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400 w-8 text-right shrink-0">{count}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={filterRating}
            onChange={e => setFilterRating(Number(e.target.value))}
            className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:border-indigo-400"
          >
            <option value={0}>All ratings</option>
            {[5, 4, 3, 2, 1].map(r => (
              <option key={r} value={r}>{RATING_LABELS[r]} ({r}★)</option>
            ))}
          </select>
          {pages.length > 1 && (
            <select
              value={filterPage}
              onChange={e => setFilterPage(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:border-indigo-400"
            >
              <option value="">All pages</option>
              {pages.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          )}
          {(filterRating !== 0 || filterPage) && (
            <button
              onClick={() => { setFilterRating(0); setFilterPage(''); }}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Clear filters
            </button>
          )}
          <span className="text-xs text-gray-400 dark:text-gray-500 ml-auto">{filtered.length} shown</span>
        </div>

        {/* Feedback list */}
        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400 dark:text-gray-500">
            <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p>No feedback yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(f => (
              <div key={f.id} className="bg-white dark:bg-gray-900 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-800">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-3">
                    <StarDisplay rating={f.rating} />
                    <span className={`text-sm font-semibold ${RATING_COLORS[f.rating]}`}>{RATING_LABELS[f.rating]}</span>
                  </div>
                  <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">{fmt(f.created_at)}</span>
                </div>
                {f.message && (
                  <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-3 whitespace-pre-wrap">
                    {f.message}
                  </p>
                )}
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 rounded-full">
                    {f.user_name}
                  </span>
                  {f.lesson_title && (
                    <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 rounded-full">
                      {f.lesson_title}
                    </span>
                  )}
                  <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-500 rounded-full">
                    {f.page}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
