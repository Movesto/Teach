import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Clock, Volume2, CheckCircle } from 'lucide-react';
import { apiFetch } from '../utils/api';

function ReaderView() {
  const { readerId } = useParams();
  const [reader, setReader] = useState(null);
  const [error, setError] = useState(null);
  const [chapterIdx, setChapterIdx] = useState(0);
  const [phase, setPhase] = useState('read');          // read | questions | result
  const [answers, setAnswers] = useState({});
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [reflection, setReflection] = useState(() => {
    try { return localStorage.getItem(`reader_reflection_${readerId}`) || ''; } catch { return ''; }
  });
  const topRef = useRef(null);

  useEffect(() => {
    apiFetch(`/api/readers/${readerId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Reader not found'))))
      .then((data) => {
        setReader(data);
        // resume at bookmarked chapter if it's this reader
        try {
          const bm = JSON.parse(localStorage.getItem('reader_bookmark') || 'null');
          if (bm && bm.readerId === readerId && bm.chapterIdx < data.chapters.length) {
            setChapterIdx(bm.chapterIdx);
          }
        } catch { /* ignore */ }
      })
      .catch((e) => setError(e.message));
  }, [readerId]);

  // keep the "continue reading" bookmark current
  useEffect(() => {
    if (!reader) return;
    try {
      localStorage.setItem('reader_bookmark', JSON.stringify({ readerId, title: reader.title, chapterIdx }));
    } catch { /* ignore */ }
  }, [reader, readerId, chapterIdx]);

  const goToChapter = (idx) => {
    setChapterIdx(idx);
    setPhase('read');
    setAnswers({});
    setResult(null);
    if (topRef.current) topRef.current.scrollIntoView({ behavior: 'smooth' });
  };

  const submitAnswers = async () => {
    setSubmitting(true);
    const chapter = reader.chapters[chapterIdx];
    try {
      const res = await apiFetch(`/api/readers/${readerId}/chapters/${chapterIdx}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          answers: chapter.questions.map((q) => ({ question_id: q.id, answer: answers[q.id] ?? null })),
        }),
      });
      if (!res.ok) throw new Error();
      setResult(await res.json());
      setPhase('result');
    } catch {
      setError('Could not check your answers — please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
        <Link to="/library" className="text-indigo-600 dark:text-indigo-400 font-medium">← Back to Library</Link>
      </div>
    );
  }
  if (!reader) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const chapter = reader.chapters[chapterIdx];
  const isLast = chapterIdx === reader.chapters.length - 1;
  const paragraphs = (chapter.text || '').split(/\n{2,}/).filter(Boolean);
  const feedbackByQ = {};
  (result?.detailed_results || []).forEach((d) => { feedbackByQ[d.question_id] = d; });

  return (
    <div ref={topRef} className="max-w-3xl mx-auto p-6">
      <Link to="/library" className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4 text-sm">
        <ChevronLeft className="w-4 h-4" /> Library
      </Link>

      {/* header */}
      <div className="mb-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300">{reader.level}</span>
          <span className="text-xs text-gray-500 dark:text-gray-400">{reader.title}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
          <span>Chapter {chapterIdx + 1} of {reader.chapters.length}</span>
          <span>·</span>
          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> ~{Math.max(1, Math.round((chapter.word_count || 0) / 180))} min</span>
        </div>
      </div>

      {/* READING */}
      {phase === 'read' && (
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-6 sm:p-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">{chapter.title}</h2>

          <div className="flex items-center gap-2 mb-6 text-sm text-gray-600 dark:text-gray-400">
            <Volume2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span>Listen while you read (first play takes a few seconds to generate):</span>
          </div>
          <audio controls preload="none" src={chapter.audio} className="w-full mb-6">
            Your browser does not support audio.
          </audio>

          <div className="prose-reader space-y-4 text-[17px] leading-8 text-gray-800 dark:text-gray-200">
            {paragraphs.map((p, i) => <p key={i}>{p}</p>)}
          </div>

          {chapter.vocabulary?.length > 0 && (
            <div className="mt-8 bg-gray-50 dark:bg-gray-800 rounded-xl p-5">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3 text-sm">Words to know</h3>
              <dl className="space-y-1.5 text-sm">
                {chapter.vocabulary.map((v, i) => (
                  <div key={i} className="flex gap-2">
                    <dt className="font-semibold text-gray-900 dark:text-white">{v.word}</dt>
                    <dd className="text-gray-600 dark:text-gray-400">— {v.definition}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          <button
            onClick={() => setPhase('questions')}
            disabled={!chapter.questions?.length}
            className="w-full mt-8 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {chapter.questions?.length ? 'Answer questions' : 'No questions'}
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* QUESTIONS + RESULT (same list, styled by result state) */}
      {(phase === 'questions' || phase === 'result') && (
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-6 sm:p-8">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Comprehension</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Questions about "{chapter.title}".</p>

          <div className="space-y-6">
            {chapter.questions.map((q, idx) => {
              const fb = feedbackByQ[q.id];
              return (
                <div key={q.id} className="border dark:border-gray-700 rounded-xl p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <span className="text-sm font-bold text-gray-400 dark:text-gray-500 mt-0.5 w-5 flex-shrink-0">#{idx + 1}</span>
                    <h4 className="text-gray-900 dark:text-white font-medium flex-1">{q.question}</h4>
                    {q.type && <span className="text-[11px] px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 flex-shrink-0">{q.type}</span>}
                  </div>
                  <div className="space-y-2 pl-8">
                    {q.options.map((opt, optIdx) => {
                      const selected = answers[q.id] === optIdx;
                      const isCorrect = phase === 'result' && fb && optIdx === fb.correct_answer;
                      const wrongPick = phase === 'result' && selected && fb && !fb.correct;
                      return (
                        <label
                          key={optIdx}
                          className={`flex items-center p-3 border rounded-lg text-sm transition-all ${
                            phase === 'result'
                              ? isCorrect
                                ? 'bg-green-50 dark:bg-green-900/20 border-green-400 dark:border-green-600'
                                : wrongPick
                                ? 'bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-600'
                                : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
                              : selected
                              ? 'bg-indigo-50 dark:bg-indigo-900/20 border-indigo-400 dark:border-indigo-600 cursor-pointer'
                              : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-600 cursor-pointer'
                          }`}
                        >
                          <input
                            type="radio"
                            name={q.id}
                            disabled={phase === 'result'}
                            checked={selected}
                            onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: optIdx }))}
                            className="mr-3 flex-shrink-0"
                          />
                          <span className="flex-1 text-gray-900 dark:text-white">{opt}</span>
                          {isCorrect && <span className="text-green-600 dark:text-green-400 font-bold ml-2">✓</span>}
                          {wrongPick && <span className="text-red-600 dark:text-red-400 font-bold ml-2">✗</span>}
                        </label>
                      );
                    })}
                  </div>
                  {phase === 'result' && fb?.explanation && (
                    <p className="pl-8 mt-3 text-sm text-gray-600 dark:text-gray-400 italic">{fb.explanation}</p>
                  )}
                </div>
              );
            })}
          </div>

          {phase === 'questions' && (
            <button
              onClick={submitAnswers}
              disabled={submitting || Object.keys(answers).length < chapter.questions.length}
              className="w-full mt-8 py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? 'Checking…' : 'Check answers'}
            </button>
          )}

          {phase === 'result' && result && (
            <div className="mt-8">
              <div className="rounded-xl p-5 mb-4 text-center bg-indigo-50 dark:bg-indigo-900/20 border-2 border-indigo-200 dark:border-indigo-700">
                <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1">{result.score}%</p>
                <p className="text-indigo-700 dark:text-indigo-300 font-medium">
                  {result.correct_answers} of {result.total_questions} correct
                </p>
              </div>
              {!isLast ? (
                <button
                  onClick={() => goToChapter(chapterIdx + 1)}
                  className="w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 flex items-center justify-center gap-2"
                >
                  Next chapter <ChevronRight className="w-5 h-5" />
                </button>
              ) : (
                <FinishBlock reader={reader} reflection={reflection} setReflection={setReflection} readerId={readerId} />
              )}
            </div>
          )}
        </div>
      )}

      {/* chapter dots */}
      <div className="flex items-center justify-center gap-2 mt-6">
        {reader.chapters.map((_, i) => (
          <button
            key={i}
            onClick={() => goToChapter(i)}
            className={`w-2.5 h-2.5 rounded-full transition-colors ${
              i === chapterIdx ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-700 hover:bg-gray-400'
            }`}
            title={`Chapter ${i + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

function FinishBlock({ reader, reflection, setReflection, readerId }) {
  const prompt = reader.writing_prompt;
  const draftKey = `reader_reflection_${readerId}`;
  const words = reflection.trim().split(/\s+/).filter(Boolean).length;
  return (
    <div>
      <div className="text-center mb-6">
        <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-2" />
        <p className="text-lg font-bold text-gray-900 dark:text-white">You finished "{reader.title}"!</p>
      </div>
      {prompt && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-5 mb-6">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2 text-sm">Write about it (optional)</h3>
          <p className="text-gray-700 dark:text-gray-300 text-sm mb-3">{prompt.prompt}</p>
          <textarea
            value={reflection}
            onChange={(e) => { setReflection(e.target.value); try { localStorage.setItem(draftKey, e.target.value); } catch { /* ignore */ } }}
            placeholder="Your thoughts…"
            className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:border-indigo-500 focus:outline-none min-h-[120px] bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {words} words{prompt.word_count_min ? ` · aim for ${prompt.word_count_min}–${prompt.word_count_max}` : ''}
          </p>
        </div>
      )}
      <Link
        to="/library"
        className="block w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 text-center"
      >
        Back to Library
      </Link>
    </div>
  );
}

export default ReaderView;
