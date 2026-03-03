import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, CheckCircle, Lock, ChevronRight, BookMarked } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function buildItems(lessons = [], books = []) {
  if (books.length === 0) return lessons.map(l => ({ type: 'lesson', data: l }));
  const result = lessons.map(l => ({ type: 'lesson', data: l }));
  books.forEach((book, i) => {
    const pos = Math.floor(((i + 1) / (books.length + 1)) * lessons.length);
    result.splice(pos + i, 0, { type: 'book', data: book });
  });
  return result;
}

function BookCard({ book, progress }) {
  const completed = progress?.completed || 0;
  const total = progress?.total || 0;
  const pct = progress?.percentage || 0;

  return (
    <Link
      to={`/book/${book.id}`}
      className="flex items-center gap-4 p-4 rounded-xl border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 hover:border-amber-500 dark:hover:border-amber-500 hover:shadow-md transition-all"
    >
      <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0">
        <BookMarked className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-0.5">
          Reading Break · Nasashada Akhrinta
        </p>
        <p className="font-bold text-gray-900 dark:text-white truncate">{book.title}</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">{book.author} · {book.level} · {book.reading_time_minutes} min read</p>
        {total > 0 && (
          <div className="mt-1.5">
            <div className="flex justify-between text-xs text-amber-600 dark:text-amber-400 mb-0.5">
              <span>{completed}/{total} chapters</span>
              {completed === total && total > 0 && <span className="text-green-600 dark:text-green-400 font-semibold">✓ Done</span>}
            </div>
            <div className="h-1.5 bg-amber-200 dark:bg-amber-900 rounded-full overflow-hidden">
              <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}
      </div>
      <ChevronRight className="w-5 h-5 text-amber-500 flex-shrink-0" />
    </Link>
  );
}

export default function Home() {
  const { token } = useAuth();
  const [units, setUnits] = useState([]);
  const [booksByUnit, setBooksByUnit] = useState({});
  const [bookProgress, setBookProgress] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    Promise.all([
      fetch('/api/units').then(r => r.json()),
      fetch('/api/books').then(r => r.json()),
      fetch('/api/user/book-progress', { headers }).then(r => r.ok ? r.json() : {}),
    ]).then(([unitData, bookData, progressData]) => {
      setUnits(unitData);
      setBookProgress(progressData);
      const grouped = {};
      bookData.forEach(b => {
        if (!grouped[b.unit_id]) grouped[b.unit_id] = [];
        grouped[b.unit_id].push(b);
      });
      setBooksByUnit(grouped);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen dark:bg-gray-950">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">All Lessons</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Dhammaan Casharka</p>
      </div>

      <div className="space-y-6">
        {units.map((unit, idx) => (
          <div key={unit.id} className="bg-white dark:bg-gray-900 rounded-xl shadow-lg overflow-hidden">
            <div className={`p-6 ${
              unit.locked
                ? 'bg-gray-100 dark:bg-gray-800'
                : idx % 2 === 0
                ? 'bg-gradient-to-r from-blue-500 to-indigo-600'
                : 'bg-gradient-to-r from-purple-500 to-pink-600'
            }`}>
              <div className="flex items-center justify-between">
                <div className={unit.locked ? 'text-gray-500 dark:text-gray-400' : 'text-white'}>
                  <div className="text-sm font-semibold mb-1 opacity-90">Unit {unit.id}</div>
                  <h2 className="text-2xl font-bold mb-1">{unit.title}</h2>
                  <p className="opacity-90">{unit.description}</p>
                </div>
                {unit.locked && <Lock className="w-8 h-8 text-gray-400 opacity-50" />}
              </div>

              {!unit.locked && (
                <div className="mt-4">
                  <div className="flex justify-between text-sm mb-1 text-white">
                    <span>Progress</span>
                    <span>{unit.completed_lessons || 0} / {unit.total_lessons} lessons</span>
                  </div>
                  <div className="h-2 bg-white/30 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white transition-all"
                      style={{ width: `${((unit.completed_lessons || 0) / unit.total_lessons) * 100}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>

            {!unit.locked && (
              <div className="p-6 grid gap-3">
                {buildItems(unit.lessons || [], booksByUnit[unit.id] || []).map((item) =>
                  item.type === 'book' ? (
                    <BookCard key={`book-${item.data.id}`} book={item.data} progress={bookProgress[item.data.id]} />
                  ) : (
                    <Link
                      key={item.data.id}
                      to={`/lesson/${item.data.id}`}
                      className={`block p-5 rounded-lg border-2 transition-all ${
                        item.data.locked
                          ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 opacity-60 cursor-not-allowed'
                          : item.data.completed
                          ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/20 hover:border-green-400 dark:hover:border-green-500 hover:shadow-md'
                          : 'border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            item.data.completed ? 'bg-green-500' : item.data.locked ? 'bg-gray-300 dark:bg-gray-600' : 'bg-blue-500'
                          }`}>
                            {item.data.completed ? (
                              <CheckCircle className="w-6 h-6 text-white" />
                            ) : item.data.locked ? (
                              <Lock className="w-5 h-5 text-white" />
                            ) : (
                              <BookOpen className="w-5 h-5 text-white" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                                Lesson {item.data.lesson_number}
                              </span>
                              {item.data.completed && item.data.score && (
                                <span className="text-xs bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200 px-2 py-0.5 rounded-full font-semibold">
                                  {item.data.score}%
                                </span>
                              )}
                            </div>
                            <h3 className="font-bold text-gray-900 dark:text-white">{item.data.title}</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{item.data.description}</p>
                          </div>
                        </div>
                        {!item.data.locked && <ChevronRight className="w-6 h-6 text-gray-400 dark:text-gray-600" />}
                      </div>
                    </Link>
                  )
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
