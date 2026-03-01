import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BookOpen, CheckCircle, ChevronRight, BookMarked, RotateCcw, Play } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const CEFR_BADGE = {
  A1: 'bg-gray-100 text-gray-700',
  A2: 'bg-blue-100 text-blue-700',
  B1: 'bg-green-100 text-green-700',
  B2: 'bg-teal-100 text-teal-700',
  C1: 'bg-indigo-100 text-indigo-700',
};

export default function Dashboard() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [units, setUnits] = useState([]);
  const [books, setBooks] = useState([]);
  const [activeTab, setActiveTab] = useState('lessons');
  const [loading, setLoading] = useState(true);
  const [openUnit, setOpenUnit] = useState(null);

  useEffect(() => {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    Promise.all([
      fetch('/api/units').then(r => r.json()),
      fetch('/api/books').then(r => r.json()),
    ])
      .then(([unitData, bookData]) => {
        setUnits(unitData);
        setBooks(bookData);
        // Auto-open first unit
        if (unitData.length > 0) setOpenUnit(unitData[0].id);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const cefr = user?.cefr_level?.toUpperCase() || '—';
  const cefrClass = CEFR_BADGE[cefr] || 'bg-gray-100 text-gray-700';

  // Find first incomplete lesson across all units for "continue" card
  let continueLesson = null;
  let continueUnit = null;
  for (const unit of units) {
    const inc = unit.lessons?.find(l => !l.completed);
    if (inc) { continueLesson = inc; continueUnit = unit; break; }
  }

  // Count completed lessons
  const totalCompleted = units.reduce((sum, u) => sum + (u.completed_lessons || 0), 0);

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
              Welcome back, {user?.name}!
            </h1>
            <p className="text-indigo-500 font-medium mt-0.5">
              Ku soo dhawoow, {user?.name}!
            </p>
          </div>
          <div className="flex items-center gap-3">
            {cefr !== '—' && (
              <span className={`px-3 py-1.5 rounded-full text-sm font-bold border ${cefrClass}`}>
                {cefr}
              </span>
            )}
            <button
              onClick={() => navigate('/placement?retake=true')}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 border border-gray-200 rounded-lg px-3 py-1.5 hover:border-indigo-300 transition-colors"
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
        <div className="bg-white rounded-xl shadow-sm p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{totalCompleted}</div>
          <div className="text-sm text-gray-500 mt-0.5 flex items-center justify-center gap-1">
            <CheckCircle className="w-3.5 h-3.5 text-green-500" /> Lessons
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 text-center">
          <div className="text-2xl font-bold text-gray-900">{books.length}</div>
          <div className="text-sm text-gray-500 mt-0.5 flex items-center justify-center gap-1">
            <BookMarked className="w-3.5 h-3.5 text-amber-500" /> Books
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 text-center">
          <div className={`text-xl font-bold px-2 py-0.5 rounded-lg inline-block ${cefrClass}`}>{cefr}</div>
          <div className="text-sm text-gray-500 mt-0.5">Level</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-6 w-fit">
        {['lessons', 'books'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab === 'lessons' ? 'My Lessons' : 'My Books'}
          </button>
        ))}
      </div>

      {/* Lessons tab */}
      {activeTab === 'lessons' && (
        <div className="space-y-3">
          {units.map((unit, uIdx) => (
            <div key={unit.id} className="bg-white rounded-xl shadow-sm overflow-hidden">
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
                  <ChevronRight className={`w-5 h-5 transition-transform ${openUnit === unit.id ? 'rotate-90' : ''}`} />
                </div>
              </button>

              {openUnit === unit.id && (
                <div className="p-4 grid gap-2">
                  {unit.lessons?.map(lesson => (
                    <Link
                      key={lesson.id}
                      to={`/lesson/${lesson.id}`}
                      className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all ${
                        lesson.completed
                          ? 'border-green-200 bg-green-50 hover:border-green-400'
                          : 'border-blue-100 bg-blue-50 hover:border-blue-300 hover:shadow-sm'
                      }`}
                    >
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 ${
                        lesson.completed ? 'bg-green-500' : 'bg-blue-500'
                      }`}>
                        {lesson.completed
                          ? <CheckCircle className="w-5 h-5 text-white" />
                          : <BookOpen className="w-4 h-4 text-white" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-500 font-medium">Lesson {lesson.lesson_number}</p>
                        <p className="font-semibold text-gray-900 truncate">{lesson.title}</p>
                      </div>
                      {lesson.completed && lesson.score && (
                        <span className="text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded-full font-semibold flex-shrink-0">
                          {lesson.score}%
                        </span>
                      )}
                      <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Books tab */}
      {activeTab === 'books' && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {books.map(book => (
            <Link
              key={book.id}
              to={`/book/${book.id}`}
              className="bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow overflow-hidden border border-gray-100"
            >
              {book.cover_image && (
                <img
                  src={book.cover_image}
                  alt={book.title}
                  className="w-full h-40 object-cover"
                />
              )}
              <div className="p-4">
                <h3 className="font-bold text-gray-900 text-sm truncate">{book.title}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{book.author}</p>
                <div className="flex items-center gap-2 mt-2">
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-full text-xs">{book.level}</span>
                  <span className="text-xs text-gray-400">Unit {book.unit_id}</span>
                </div>
              </div>
            </Link>
          ))}
          {books.length === 0 && (
            <p className="text-gray-500 col-span-3 text-center py-8">No books available yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
