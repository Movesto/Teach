import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Clock, ArrowRight, Check } from 'lucide-react';
import { apiFetch } from '../utils/api';
import { listOfflineReaders } from '../utils/offline';

const LEVEL_ORDER = ['A2', 'B1', 'B2', 'C1'];

function Chip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
        active
          ? 'bg-indigo-600 text-white'
          : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
      }`}
    >
      {children}
    </button>
  );
}

function readBookmark() {
  try {
    const raw = localStorage.getItem('reader_bookmark');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function Library() {
  const [readers, setReaders] = useState(null);
  const [error, setError] = useState(null);
  const [level, setLevel] = useState('all');
  const [tag, setTag] = useState('all');
  const [bookmark] = useState(readBookmark);

  useEffect(() => {
    apiFetch('/api/readers')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Could not load the library'))))
      .then(setReaders)
      .catch((e) => setError(e.message));
  }, []);

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <p className="text-gray-600 dark:text-gray-400">{error}</p>
      </div>
    );
  }
  if (!readers) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const offlineReaders = listOfflineReaders();
  const levels = LEVEL_ORDER.filter((l) => readers.some((r) => r.level === l));
  const tags = [...new Set(readers.flatMap((r) => r.interest_tags || []))].sort();
  const shown = readers.filter(
    (r) => (level === 'all' || r.level === level) && (tag === 'all' || (r.interest_tags || []).includes(tag)),
  );

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-indigo-600" /> Reading Library
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm">
          Graded stories and articles at your level. Read, listen, and answer a few questions.
        </p>
      </div>

      {bookmark && (
        <Link
          to={`/reader/${bookmark.readerId}`}
          className="flex items-center justify-between gap-3 mb-6 p-4 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors"
        >
          <div>
            <p className="text-xs uppercase tracking-wide text-indigo-600 dark:text-indigo-400 font-semibold">Continue reading</p>
            <p className="font-semibold text-gray-900 dark:text-white">{bookmark.title}</p>
          </div>
          <ArrowRight className="w-5 h-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
        </Link>
      )}

      {/* Filters */}
      <div className="space-y-2 mb-6">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 w-12">Level</span>
          <Chip active={level === 'all'} onClick={() => setLevel('all')}>All</Chip>
          {levels.map((l) => (
            <Chip key={l} active={level === l} onClick={() => setLevel(l)}>{l}</Chip>
          ))}
        </div>
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 w-12">Topic</span>
            <Chip active={tag === 'all'} onClick={() => setTag('all')}>All</Chip>
            {tags.map((t) => (
              <Chip key={t} active={tag === t} onClick={() => setTag(t)}>{t}</Chip>
            ))}
          </div>
        )}
      </div>

      {shown.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400 text-center py-12">No readers match those filters yet.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {shown.map((r) => (
            <Link
              key={r.id}
              to={`/reader/${r.id}`}
              className="flex flex-col rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-5 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md transition-all"
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">{r.level}</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">{r.genre}</span>
                {offlineReaders[r.id] && (
                  <span className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-green-600 dark:text-green-400" title="Available offline">
                    <Check className="w-3 h-3" /> Offline
                  </span>
                )}
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-1">{r.title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 flex-1 leading-relaxed">{r.description}</p>
              <div className="flex items-center gap-3 mt-3 text-xs text-gray-500 dark:text-gray-400">
                <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> ~{r.reading_time_minutes} min</span>
                <span>{r.chapter_count} chapter{r.chapter_count !== 1 ? 's' : ''}</span>
                <span>{r.word_count?.toLocaleString()} words</span>
              </div>
              {(r.interest_tags || []).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {r.interest_tags.map((t) => (
                    <span key={t} className="px-2 py-0.5 rounded-full text-[11px] bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">{t}</span>
                  ))}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default Library;
