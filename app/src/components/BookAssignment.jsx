import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle, Clock, ChevronRight, ChevronLeft, BookOpen, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function BookAssignment({ bookId: bookIdProp, studentId: studentIdProp }) {
  const params = useParams();
  const { user } = useAuth();
  const bookId = bookIdProp || params.bookId;
  const studentId = studentIdProp || user?.id || '00000000-0000-0000-0000-000000000001';

  // Top-level book data
  const [book, setBook] = useState(null);
  const [chapters, setChapters] = useState([]);
  const [loadError, setLoadError] = useState(null);

  // Chapter-level state
  const [completedChapters, setCompletedChapters] = useState(new Set());
  const [activeChapter, setActiveChapter] = useState(null);
  const [loadingChapter, setLoadingChapter] = useState(false);

  // Phase within a chapter: 'reading' | 'quiz' | 'writing' | 'done'
  const [chapterPhase, setChapterPhase] = useState('reading');
  const [chapterAssignment, setChapterAssignment] = useState(null);

  // Quiz state
  const [answers, setAnswers] = useState({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState(null);

  // Writing state
  const [currentWritingIdx, setCurrentWritingIdx] = useState(0);
  const [writingText, setWritingText] = useState('');
  const [writingState, setWritingState] = useState('idle'); // 'idle' | 'loading' | 'passed' | 'failed'
  const [writingAssessment, setWritingAssessment] = useState(null);
  const writingAbortRef = useRef(null);

  // PDF reading tracking
  const [pdfOpened, setPdfOpened] = useState(false);

  // Load book and chapters on mount
  useEffect(() => {
    Promise.all([
      fetch(`/api/books/${bookId}`).then(r => {
        if (!r.ok) throw new Error('Book not found');
        return r.json();
      }),
      fetch(`/api/books/${bookId}/chapters`).then(r => r.ok ? r.json() : []),
    ])
      .then(([bookData, chaptersData]) => {
        setBook(bookData);
        setChapters(chaptersData);
      })
      .catch(err => setLoadError(err.message));
  }, [bookId]);

  const writingDraftKey = (chapterId, promptIdx) =>
    `book_draft_${bookId}_${chapterId}_${promptIdx}`;

  const openChapter = async (chapter) => {
    // Abort any in-flight writing assessment from a previous chapter
    if (writingAbortRef.current) {
      writingAbortRef.current.abort();
      writingAbortRef.current = null;
    }
    setActiveChapter(chapter);
    setChapterPhase('reading');
    setAnswers({});
    setQuizSubmitted(false);
    setQuizScore(null);
    setCurrentWritingIdx(0);
    setPdfOpened(false);
    // Restore any saved draft for prompt 0 of this chapter
    const savedDraft = localStorage.getItem(writingDraftKey(chapter.id, 0)) || '';
    setWritingText(savedDraft);
    setWritingState('idle');
    setWritingAssessment(null);
    setLoadingChapter(true);
    try {
      const res = await fetch(`/api/books/${bookId}/chapters/${chapter.id}/assignment/${studentId}`);
      const data = await res.json();
      setChapterAssignment(data);
    } catch {
      setChapterAssignment({ questions: [], writing_prompts: [] });
    } finally {
      setLoadingChapter(false);
    }
  };

  const handleAnswerChange = (questionId, value) => {
    setAnswers(prev => ({ ...prev, [questionId]: value }));
  };

  const submitQuiz = () => {
    const questions = chapterAssignment?.questions || [];
    let correct = 0;
    questions.forEach(q => {
      if (answers[q.id] === q.correct) correct++;
    });
    setQuizScore(Math.round((correct / Math.max(questions.length, 1)) * 100));
    setQuizSubmitted(true);
  };

  const proceedAfterQuiz = () => {
    const prompts = chapterAssignment?.writing_prompts || [];
    if (prompts.length > 0) {
      setChapterPhase('writing');
    } else {
      completeChapter();
    }
  };

  const submitWriting = async () => {
    const prompts = chapterAssignment?.writing_prompts || [];
    const prompt = prompts[currentWritingIdx];
    if (!prompt) return;
    setWritingState('loading');
    const controller = new AbortController();
    writingAbortRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 90000);
    try {
      const res = await fetch('/api/writing/assess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          writing_text: writingText,
          prompt_instruction: prompt.prompt,
          min_words: prompt.word_count_min || 40,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await res.json();
      setWritingAssessment(data);
      setWritingState(data.passed ? 'passed' : 'failed');
    } catch {
      clearTimeout(timeout);
      setWritingAssessment({ score: null, passed: true, feedback: 'Assessment unavailable. Writing accepted.' });
      setWritingState('passed');
    }
  };

  const nextWritingPrompt = () => {
    const prompts = chapterAssignment?.writing_prompts || [];
    localStorage.removeItem(writingDraftKey(activeChapter.id, currentWritingIdx));
    if (currentWritingIdx + 1 < prompts.length) {
      const nextIdx = currentWritingIdx + 1;
      setCurrentWritingIdx(nextIdx);
      setWritingText(localStorage.getItem(writingDraftKey(activeChapter.id, nextIdx)) || '');
      setWritingAssessment(null);
      setWritingState('idle');
    } else {
      completeChapter();
    }
  };

  const retryWriting = () => {
    setWritingAssessment(null);
    setWritingState('idle');
  };

  const completeChapter = () => {
    setCompletedChapters(prev => new Set([...prev, activeChapter.id]));
    setChapterPhase('done');
  };

  const goToNextChapter = () => {
    const idx = chapters.findIndex(c => c.id === activeChapter.id);
    if (idx < chapters.length - 1) {
      openChapter(chapters[idx + 1]);
    } else {
      setActiveChapter(null);
    }
  };

  // ── Error state ──
  if (loadError) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-8">
          <p className="text-2xl mb-3">📚</p>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Book Assignment</h2>
          <p className="text-gray-600 mb-4">{loadError}</p>
          <p className="text-sm text-gray-500 mb-6">Questions for this book are coming soon.</p>
          <button
            onClick={() => window.history.back()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // ── Loading state ──
  if (!book) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading book...</p>
        </div>
      </div>
    );
  }

  // ── Chapter active view ──
  if (activeChapter) {
    if (loadingChapter) {
      return (
        <div className="max-w-3xl mx-auto p-6 flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
        </div>
      );
    }

    const chapterIdx = chapters.findIndex(c => c.id === activeChapter.id);
    const questions = chapterAssignment?.questions || [];
    const writingPrompts = chapterAssignment?.writing_prompts || [];
    const currentPrompt = writingPrompts[currentWritingIdx];

    return (
      <div className="max-w-3xl mx-auto p-6">
        {/* Back button */}
        <button
          onClick={() => setActiveChapter(null)}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6 text-sm"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to {book.title}
        </button>

        {/* READING PHASE */}
        {chapterPhase === 'reading' && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <p className="text-sm text-blue-600 font-semibold uppercase tracking-wide mb-2">
              Chapter {chapterIdx + 1} of {chapters.length}
            </p>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{activeChapter.title}</h2>
            {activeChapter.description && (
              <p className="text-gray-600 mb-4">{activeChapter.description}</p>
            )}
            <div className="flex items-center gap-2 text-sm text-gray-500 mb-8">
              <Clock className="w-4 h-4" />
              <span>~{activeChapter.reading_time_minutes} min read</span>
              <span className="mx-1">·</span>
              <span>Pages {activeChapter.page_start}–{activeChapter.page_end}</span>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mb-8">
              <div className="flex items-center gap-3 mb-3">
                <BookOpen className="w-5 h-5 text-blue-600" />
                <h3 className="font-semibold text-blue-900">Read the Book</h3>
              </div>
              <p className="text-blue-800 text-sm mb-4">
                Open the book to pages {activeChapter.page_start}–{activeChapter.page_end} and read this section before starting the quiz.
              </p>
              <a
                href={`${book.pdf_url}#page=${activeChapter.page_start}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setPdfOpened(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold text-sm"
              >
                <BookOpen className="w-4 h-4" />
                Open Book — Pages {activeChapter.page_start}–{activeChapter.page_end}
              </a>
              {pdfOpened && (
                <p className="mt-3 text-sm text-green-700 font-medium">✓ Book opened — you can start the quiz when ready.</p>
              )}
            </div>

            {!pdfOpened && (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 mb-4">
                Please open the book above and read pages {activeChapter.page_start}–{activeChapter.page_end} before starting the quiz.
              </p>
            )}
            <button
              onClick={() => setChapterPhase('quiz')}
              disabled={!pdfOpened}
              className="w-full py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Start Chapter Quiz
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}

        {/* QUIZ PHASE */}
        {chapterPhase === 'quiz' && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Quiz: {activeChapter.title}</h2>
            <p className="text-gray-600 mb-6 text-sm">Answer these questions about what you just read. You need <strong>60%</strong> to continue.</p>

            {questions.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No questions available for this chapter.</p>
            ) : (
              <div className="space-y-6 mb-8">
                {questions.map((question, idx) => (
                  <div key={question.id} className="border rounded-xl p-5">
                    <div className="flex items-start gap-3 mb-4">
                      <span className="text-sm font-bold text-gray-400 mt-0.5 w-5 flex-shrink-0">#{idx + 1}</span>
                      <h4 className="text-gray-900 font-medium flex-1">{question.question}</h4>
                      <span className={`px-2 py-0.5 rounded text-xs flex-shrink-0 ${
                        question.difficulty === 'easy' ? 'bg-green-100 text-green-800' :
                        question.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>{question.difficulty}</span>
                    </div>
                    <div className="space-y-2 pl-8">
                      {question.options?.map((option, optIdx) => {
                        const isSelected = answers[question.id] === optIdx;
                        const isCorrect = optIdx === question.correct;
                        return (
                          <label
                            key={optIdx}
                            className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all text-sm ${
                              quizSubmitted
                                ? isCorrect
                                  ? 'bg-green-50 border-green-400'
                                  : isSelected
                                  ? 'bg-red-50 border-red-300'
                                  : 'bg-gray-50 border-gray-200'
                                : isSelected
                                ? 'bg-blue-50 border-blue-400'
                                : 'bg-gray-50 border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                            }`}
                          >
                            <input
                              type="radio"
                              name={question.id}
                              disabled={quizSubmitted}
                              checked={isSelected}
                              onChange={() => handleAnswerChange(question.id, optIdx)}
                              className="mr-3 flex-shrink-0"
                            />
                            <span className="flex-1">{option}</span>
                            {quizSubmitted && isCorrect && <span className="text-green-600 font-bold ml-2">✓</span>}
                            {quizSubmitted && isSelected && !isCorrect && <span className="text-red-600 font-bold ml-2">✗</span>}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!quizSubmitted ? (
              <button
                onClick={submitQuiz}
                disabled={Object.keys(answers).length < questions.length}
                className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Submit Quiz
              </button>
            ) : (
              <div>
                <div className={`rounded-xl p-5 mb-4 text-center ${
                  quizScore >= 60 ? 'bg-green-50 border-2 border-green-300' : 'bg-orange-50 border-2 border-orange-300'
                }`}>
                  <p className="text-3xl font-bold mb-1">{quizScore}%</p>
                  <p className={`font-medium ${quizScore >= 60 ? 'text-green-700' : 'text-orange-700'}`}>
                    {quizScore >= 60 ? 'Well done!' : `You need 60% to continue. Try again!`}
                  </p>
                </div>
                {quizScore >= 60 ? (
                  <button
                    onClick={proceedAfterQuiz}
                    className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 flex items-center justify-center gap-2"
                  >
                    {writingPrompts.length > 0 ? 'Continue to Writing' : 'Complete Chapter'}
                    <ChevronRight className="w-5 h-5" />
                  </button>
                ) : (
                  <button
                    onClick={() => { setQuizSubmitted(false); setAnswers({}); setQuizScore(null); }}
                    className="w-full py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700"
                  >
                    Retry Quiz
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* WRITING PHASE */}
        {chapterPhase === 'writing' && currentPrompt && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-1">Writing</h2>
            {writingPrompts.length > 1 && (
              <p className="text-sm text-gray-500 mb-4">
                Prompt {currentWritingIdx + 1} of {writingPrompts.length}
              </p>
            )}

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 mb-6">
              <p className="text-gray-800 leading-relaxed">{currentPrompt.prompt}</p>
              <p className="text-sm text-gray-500 mt-3">
                {currentPrompt.word_count_min}–{currentPrompt.word_count_max} words
              </p>
            </div>

            <textarea
              value={writingText}
              onChange={(e) => {
                setWritingText(e.target.value);
                localStorage.setItem(writingDraftKey(activeChapter.id, currentWritingIdx), e.target.value);
              }}
              placeholder="Write your response here..."
              disabled={writingState === 'loading' || writingState === 'passed'}
              className="w-full p-4 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none min-h-[200px] disabled:bg-gray-50 disabled:cursor-not-allowed mb-2"
            />
            <p className="text-sm text-gray-500 mb-5">
              {writingText.trim().split(/\s+/).filter(Boolean).length} words
            </p>

            {writingState === 'idle' && (
              <button
                onClick={submitWriting}
                disabled={writingText.length < 20}
                className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Submit for Review
              </button>
            )}

            {writingState === 'loading' && (
              <div className="w-full py-3 bg-blue-100 text-blue-700 rounded-lg text-center flex items-center justify-center gap-3 font-semibold">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
                Evaluating your writing...
              </div>
            )}

            {writingState === 'passed' && writingAssessment && (
              <div className="bg-green-50 border-2 border-green-400 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl font-bold text-green-700">
                    {writingAssessment.score !== null ? `${writingAssessment.score}/100` : '✓'}
                  </span>
                  <span className="text-green-800 font-semibold text-lg">Passed!</span>
                </div>
                {writingAssessment.feedback && (
                  <p className="text-green-900 mb-4">{writingAssessment.feedback}</p>
                )}
                <button
                  onClick={nextWritingPrompt}
                  className="w-full py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 flex items-center justify-center gap-2"
                >
                  {currentWritingIdx + 1 < writingPrompts.length ? 'Next Writing Prompt' : 'Complete Chapter'}
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}

            {writingState === 'failed' && writingAssessment && (
              <div className="bg-orange-50 border-2 border-orange-400 rounded-xl p-5">
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl font-bold text-orange-700">{writingAssessment.score}/100</span>
                  <span className="text-orange-800 font-semibold">Not yet passing</span>
                </div>
                {writingAssessment.feedback && (
                  <p className="text-orange-900 mb-3">{writingAssessment.feedback}</p>
                )}
                <p className="text-sm text-orange-700 mb-4">Score needed: 60/100</p>
                <button
                  onClick={retryWriting}
                  className="w-full py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700"
                >
                  Try Again
                </button>
              </div>
            )}
          </div>
        )}

        {/* DONE PHASE */}
        {chapterPhase === 'done' && (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Chapter Complete!</h2>
            <p className="text-gray-600 mb-8">You finished "{activeChapter.title}".</p>

            {chapterIdx < chapters.length - 1 ? (
              <button
                onClick={goToNextChapter}
                className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 flex items-center justify-center gap-2 mb-3"
              >
                Next Chapter
                <ChevronRight className="w-5 h-5" />
              </button>
            ) : (
              <div className="mb-3">
                <p className="text-green-700 font-semibold mb-4">You have completed all chapters!</p>
                <button
                  onClick={() => window.location.href = '/dashboard'}
                  className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
                >
                  Return to Dashboard
                </button>
              </div>
            )}

            <button
              onClick={() => setActiveChapter(null)}
              className="w-full py-2 text-gray-500 hover:text-gray-800 text-sm"
            >
              Back to chapter list
            </button>
          </div>
        )}
      </div>
    );
  }

  // ── Book overview + chapter list ──
  return (
    <div className="max-w-3xl mx-auto p-6">
      {/* Book header */}
      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <div className="flex gap-4">
          <img
            src={book.cover_image}
            alt={book.title}
            className="w-24 h-36 object-cover rounded-lg shadow flex-shrink-0"
          />
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{book.title}</h1>
            <p className="text-gray-600 mb-3">by {book.author}</p>
            <div className="flex flex-wrap gap-2 mb-3">
              <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">{book.level}</span>
              <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm">
                {chapters.length} chapter{chapters.length !== 1 ? 's' : ''}
              </span>
              {completedChapters.size > 0 && (
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                  {completedChapters.size}/{chapters.length} complete
                </span>
              )}
            </div>
            <p className="text-gray-700 text-sm leading-relaxed">{book.description}</p>
          </div>
        </div>
      </div>

      {/* Chapter list */}
      {chapters.length === 0 ? (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-8 text-center">
          <p className="text-yellow-800 font-medium">Chapters for this book are coming soon.</p>
          <button
            onClick={() => window.history.back()}
            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
          >
            Go Back
          </button>
        </div>
      ) : (
        <div>
          <h2 className="text-lg font-bold text-gray-900 mb-4">Chapters</h2>
          <div className="space-y-3">
            {chapters.map((chapter, idx) => {
              const isDone = completedChapters.has(chapter.id);
              const isLocked = idx > 0 && !completedChapters.has(chapters[idx - 1].id);

              return (
                <div
                  key={chapter.id}
                  onClick={() => !isLocked && openChapter(chapter)}
                  className={`bg-white rounded-xl border-2 p-5 transition-all ${
                    isDone
                      ? 'border-green-400 bg-green-50'
                      : isLocked
                      ? 'border-gray-200 opacity-60 cursor-not-allowed'
                      : 'border-blue-200 hover:border-blue-400 cursor-pointer hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 ${
                        isDone
                          ? 'bg-green-500 text-white'
                          : isLocked
                          ? 'bg-gray-200 text-gray-500'
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {isDone ? '✓' : isLocked ? <Lock className="w-4 h-4" /> : idx + 1}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{chapter.title}</h3>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-0.5">
                          <Clock className="w-3.5 h-3.5" />
                          <span>~{chapter.reading_time_minutes} min</span>
                          <span>·</span>
                          <span>Pages {chapter.page_start}–{chapter.page_end}</span>
                        </div>
                      </div>
                    </div>
                    {isDone && (
                      <span className="text-green-600 text-sm font-medium flex-shrink-0">Complete</span>
                    )}
                    {!isDone && !isLocked && (
                      <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    )}
                  </div>
                  {chapter.description && (
                    <p className="text-sm text-gray-500 mt-2 pl-12 leading-relaxed">{chapter.description}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default BookAssignment;
