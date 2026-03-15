import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, CheckCircle, ChevronRight, BookMarked, RotateCcw, Play, Trophy } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const CEFR_BADGE = {
  A1: 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200',
  A2: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  B1: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  B2: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  C1: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
};

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
      className="flex items-center gap-3 p-4 rounded-lg border-2 border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 hover:border-amber-500 dark:hover:border-amber-500 hover:shadow-sm transition-all"
    >
      <div className="w-9 h-9 rounded-full bg-amber-500 flex items-center justify-center flex-shrink-0">
        <BookMarked className="w-4 h-4 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wide mb-0.5">Reading Break</p>
        <p className="font-semibold text-gray-900 dark:text-white truncate">{book.title}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">{book.author} · {book.level}</p>
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
      <ChevronRight className="w-4 h-4 text-amber-500 flex-shrink-0" />
    </Link>
  );
}

export default function Dashboard() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [units, setUnits] = useState([]);
  const [booksByUnit, setBooksByUnit] = useState({});
  const [bookProgress, setBookProgress] = useState({});
  const [totalBooks, setTotalBooks] = useState(0);
  const [loading, setLoading] = useState(true);
  const [openUnit, setOpenUnit] = useState(null);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    Promise.all([
      fetch('/api/units', { headers }).then(r => r.json()),
      fetch('/api/books').then(r => r.json()),
      fetch('/api/user/book-progress', { headers }).then(r => r.ok ? r.json() : {}),
    ])
      .then(([unitData, bookData, progressData]) => {
        setUnits(unitData);
        setTotalBooks(bookData.length);
        setBookProgress(progressData);
        const grouped = {};
        bookData.forEach(b => {
          if (!grouped[b.unit_id]) grouped[b.unit_id] = [];
          grouped[b.unit_id].push(b);
        });
        setBooksByUnit(grouped);
        if (unitData.length > 0) setOpenUnit(unitData[0].id);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen dark:bg-gray-950">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const cefr = user?.cefr_level?.toUpperCase() || '—';
  const cefrClass = CEFR_BADGE[cefr] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-200';

  let continueLesson = null;
  let continueUnit = null;
  for (const unit of units) {
    const inc = unit.lessons?.find(l => !l.completed);
    if (inc) { continueLesson = inc; continueUnit = unit; break; }
  }

  const totalCompleted = units.reduce((sum, u) => sum + (u.completed_lessons || 0), 0);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm p-6 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">
              Welcome back, {user?.name}!
            </h1>
            <p className="text-indigo-500 font-medium mt-0.5">
              Ku soo dhawoow, {user?.name}!
            </p>
          </div>
          <div className="flex items-center gap-3">
            {cefr !== '—' && (
              <span className={`px-3 py-1.5 rounded-full text-sm font-bold border border-transparent ${cefrClass}`}>
                {cefr}
              </span>
            )}
            <button
              onClick={() => navigate('/placement?retake=true')}
              className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-1.5 hover:border-indigo-300 dark:hover:border-indigo-600 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Retake Placement
            </button>
          </div>
        </div>
      </div>

      {/* Continue card */}
      {continueLesson && (
        <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white rounded-2xl p-6 mb-6 shadow-md">
          <p className="text-indigo-200 text-sm font-medium mb-1">Continue Learning / Sii wad Barashada</p>
          <h2 className="text-xl font-bold mb-1">
            Unit {continueUnit?.id} · Lesson {continueLesson.lesson_number}: {continueLesson.title}
          </h2>
          <p className="text-indigo-200 text-sm mb-4">{continueLesson.description}</p>
          <Link
            to={`/lesson/${continueLesson.id}`}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-indigo-700 rounded-xl font-semibold hover:bg-indigo-50 transition-colors"
          >
            <Play className="w-4 h-4" /> Continue →
          </Link>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm p-4 text-center">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{totalCompleted}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 flex items-center justify-center gap-1">
            <CheckCircle className="w-3.5 h-3.5 text-green-500" /> Lessons
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm p-4 text-center">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{totalBooks}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 flex items-center justify-center gap-1">
            <BookMarked className="w-3.5 h-3.5 text-amber-500" /> Books
          </div>
        </div>
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm p-4 text-center">
          <div className={`text-xl font-bold px-2 py-0.5 rounded-lg inline-block ${cefrClass}`}>{cefr}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Level</div>
        </div>
      </div>

      {/* Search + Lessons */}
      <div className="flex items-center justify-between mb-3 gap-3">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white whitespace-nowrap">My Lessons</h2>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search lessons..."
          className="flex-1 max-w-xs px-3 py-1.5 text-sm border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:border-indigo-400 dark:focus:border-indigo-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
        />
      </div>

      {/* Search results — flat list */}
      {search.trim() ? (
        <div className="space-y-2">
          {(() => {
            const q = search.toLowerCase();
            const results = [];
            units.forEach(unit => {
              (unit.lessons || []).forEach(lesson => {
                if (
                  lesson.title?.toLowerCase().includes(q) ||
                  lesson.description?.toLowerCase().includes(q)
                ) {
                  results.push({ type: 'lesson', data: lesson, unit });
                }
              });
              (booksByUnit[unit.id] || []).forEach(book => {
                if (book.title?.toLowerCase().includes(q) || book.author?.toLowerCase().includes(q)) {
                  results.push({ type: 'book', data: book, unit });
                }
              });
            });
            if (results.length === 0) return (
              <p className="text-center text-gray-400 dark:text-gray-500 py-8">
                No results for "{search}"
              </p>
            );
            return results.map(item =>
              item.type === 'book' ? (
                <BookCard key={`book-${item.data.id}`} book={item.data} progress={bookProgress[item.data.id]} />
              ) : (
                <Link
                  key={item.data.id}
                  to={`/lesson/${item.data.id}`}
                  className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                    item.data.completed
                      ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 hover:border-green-400 dark:hover:border-green-600'
                      : 'border-blue-100 dark:border-blue-900 bg-blue-50 dark:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                    item.data.completed ? 'bg-green-500' : 'bg-blue-500'
                  }`}>
                    {item.data.completed ? <CheckCircle className="w-5 h-5 text-white" /> : <BookOpen className="w-4 h-4 text-white" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                      Unit {item.unit.id} · Lesson {item.data.lesson_number}
                    </p>
                    <p className="font-semibold text-gray-900 dark:text-white truncate">{item.data.title}</p>
                  </div>
                  {item.data.completed && item.data.score && (
                    <span className="text-xs bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200 px-2 py-0.5 rounded-full font-semibold flex-shrink-0">
                      {item.data.score}%
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-600 flex-shrink-0" />
                </Link>
              )
            );
          })()}
        </div>
      ) : (
        /* Normal accordion */
        <div className="space-y-3">
          {units.map((unit, uIdx) => (
            <div key={unit.id} className="bg-white dark:bg-gray-900 rounded-xl shadow-sm overflow-hidden">
              <button
                onClick={() => setOpenUnit(openUnit === unit.id ? null : unit.id)}
                className={`w-full flex items-center justify-between p-5 text-left ${
                  uIdx % 2 === 0
                    ? 'bg-gradient-to-r from-blue-500 to-indigo-600'
                    : 'bg-gradient-to-r from-purple-500 to-pink-600'
                } text-white`}
              >
                <div>
                  <p className="text-xs font-semibold opacity-80 mb-0.5">Unit {unit.id}</p>
                  <h3 className="font-bold text-lg leading-tight">{unit.title}</h3>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-sm opacity-90">{unit.completed_lessons || 0}/{unit.total_lessons}</span>
                  {unit.test_done ? (
                    <span className="flex items-center gap-1 text-xs bg-white/20 text-white px-2 py-0.5 rounded-full font-semibold">
                      <Trophy className="w-3 h-3" /> {Math.round(unit.test_percentage || unit.test_score || 0)}%
                    </span>
                  ) : (
                    <Link
                      to={`/unit-test/${unit.id}`}
                      className="flex items-center gap-1 text-xs bg-amber-400 hover:bg-amber-300 text-white px-2.5 py-1 rounded-full font-semibold transition-colors"
                      onClick={e => e.stopPropagation()}
                    >
                      <Trophy className="w-3 h-3" /> Test
                    </Link>
                  )}
                  <ChevronRight className={`w-5 h-5 transition-transform ${openUnit === unit.id ? 'rotate-90' : ''}`} />
                </div>
              </button>

              {openUnit === unit.id && (
                <div className="p-4 grid gap-2">
                  {buildItems(unit.lessons || [], booksByUnit[unit.id] || []).map(item =>
                    item.type === 'book' ? (
                      <BookCard key={`book-${item.data.id}`} book={item.data} progress={bookProgress[item.data.id]} />
                    ) : (
                      <Link
                        key={item.data.id}
                        to={`/lesson/${item.data.id}`}
                        className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                          item.data.completed
                            ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 hover:border-green-400 dark:hover:border-green-600'
                            : 'border-blue-100 dark:border-blue-900 bg-blue-50 dark:bg-blue-900/20 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm'
                        }`}
                      >
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                          item.data.completed ? 'bg-green-500' : 'bg-blue-500'
                        }`}>
                          {item.data.completed
                            ? <CheckCircle className="w-5 h-5 text-white" />
                            : <BookOpen className="w-4 h-4 text-white" />
                          }
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">Lesson {item.data.lesson_number}</p>
                          <p className="font-semibold text-gray-900 dark:text-white truncate">{item.data.title}</p>
                        </div>
                        {item.data.completed && item.data.score && (
                          <span className="text-xs bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200 px-2 py-0.5 rounded-full font-semibold flex-shrink-0">
                            {item.data.score}%
                          </span>
                        )}
                        <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-600 flex-shrink-0" />
                      </Link>
                    )
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
