import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, CheckCircle, Lock, ChevronRight, BookMarked } from 'lucide-react';

export default function Home() {
  const [units, setUnits] = useState([]);
  const [booksByUnit, setBooksByUnit] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/units').then(r => r.json()),
      fetch('/api/books').then(r => r.json()),
    ]).then(([unitData, bookData]) => {
      setUnits(unitData);
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
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">All Lessons</h1>
        <p className="text-gray-500 mt-1">Dhammaan Casharka</p>
      </div>

      {/* Units */}
      <div className="space-y-6">
        {units.map((unit, idx) => (
          <div key={unit.id} className="bg-white rounded-xl shadow-lg overflow-hidden">
            {/* Unit Header */}
            <div className={`p-6 ${
              unit.locked
                ? 'bg-gray-100'
                : idx % 2 === 0
                ? 'bg-gradient-to-r from-blue-500 to-indigo-600'
                : 'bg-gradient-to-r from-purple-500 to-pink-600'
            }`}>
              <div className="flex items-center justify-between">
                <div className="text-white">
                  <div className="text-sm font-semibold mb-1 opacity-90">
                    Unit {unit.id}
                  </div>
                  <h2 className="text-2xl font-bold mb-1">{unit.title}</h2>
                  <p className="opacity-90">{unit.description}</p>
                </div>
                {unit.locked && (
                  <Lock className="w-8 h-8 text-white opacity-50" />
                )}
              </div>

              {/* Progress Bar */}
              {!unit.locked && (
                <div className="mt-4">
                  <div className="flex justify-between text-sm mb-1">
                    <span>Progress</span>
                    <span>{unit.completed_lessons || 0} / {unit.total_lessons} lessons</span>
                  </div>
                  <div className="h-2 bg-white/30 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white transition-all"
                      style={{
                        width: `${((unit.completed_lessons || 0) / unit.total_lessons) * 100}%`
                      }}
                    ></div>
                  </div>
                </div>
              )}
            </div>

            {/* Reading Assignments */}
            {!unit.locked && booksByUnit[unit.id]?.length > 0 && (
              <div className="px-6 pt-4 pb-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
                  <BookMarked className="w-4 h-4" />
                  Reading Assignments
                </h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  {booksByUnit[unit.id].map(book => (
                    <Link
                      key={book.id}
                      to={`/book/${book.id}`}
                      className="flex items-center gap-3 p-3 rounded-lg border-2 border-amber-200 bg-amber-50 hover:border-amber-400 hover:shadow-md transition-all"
                    >
                      <div className="w-9 h-9 rounded-lg bg-amber-500 flex items-center justify-center flex-shrink-0">
                        <BookMarked className="w-5 h-5 text-white" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">{book.title}</p>
                        <p className="text-xs text-gray-500">{book.author} · {book.level}</p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-400 ml-auto flex-shrink-0" />
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Lessons */}
            {!unit.locked && (
              <div className="p-6 grid gap-3">
                {unit.lessons?.map((lesson) => (
                  <Link
                    key={lesson.id}
                    to={`/lesson/${lesson.id}`}
                    className={`block p-5 rounded-lg border-2 transition-all ${
                      lesson.locked
                        ? 'border-gray-200 bg-gray-50 opacity-60 cursor-not-allowed'
                        : lesson.completed
                        ? 'border-green-300 bg-green-50 hover:border-green-400 hover:shadow-md'
                        : 'border-blue-200 bg-blue-50 hover:border-blue-400 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          lesson.completed
                            ? 'bg-green-500'
                            : lesson.locked
                            ? 'bg-gray-300'
                            : 'bg-blue-500'
                        }`}>
                          {lesson.completed ? (
                            <CheckCircle className="w-6 h-6 text-white" />
                          ) : lesson.locked ? (
                            <Lock className="w-5 h-5 text-white" />
                          ) : (
                            <BookOpen className="w-5 h-5 text-white" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-gray-600">
                              Lesson {lesson.lesson_number}
                            </span>
                            {lesson.completed && lesson.score && (
                              <span className="text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded-full font-semibold">
                                {lesson.score}%
                              </span>
                            )}
                          </div>
                          <h3 className="font-bold text-gray-900">{lesson.title}</h3>
                          <p className="text-sm text-gray-600">{lesson.description}</p>
                        </div>
                      </div>
                      {!lesson.locked && (
                        <ChevronRight className="w-6 h-6 text-gray-400" />
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}