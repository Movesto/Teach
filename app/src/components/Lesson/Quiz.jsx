import { useState, useRef, useEffect } from 'react';
import { Check, X, Volume2, ChevronRight, Trophy, HelpCircle } from 'lucide-react';
import { apiFetch } from '../../utils/api';

export function Quiz({ questions, somaliQuestions, somaliExplanations, lessonTitle, onComplete, onRequestHelp }) {
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState({});
  const [matchAnswers, setMatchAnswers] = useState({});
  const [showFeedback, setShowFeedback] = useState(false);
  const [quizComplete, setQuizComplete] = useState(false);
  const [score, setScore] = useState(0);
  const [writingError, setWritingError] = useState(false);
  const [writingResults, setWritingResults] = useState({});
  const [matchResults, setMatchResults] = useState({});
  const [assessing, setAssessing] = useState(false);
  const audioRef = useRef(null);

  // Stop audio on unmount
  useEffect(() => {
    return () => { audioRef.current?.pause(); audioRef.current = null; };
  }, []);

  const playAudio = (src) => {
    audioRef.current?.pause();
    const audio = new Audio(src);
    audioRef.current = audio;
    audio.onended = () => { audioRef.current = null; };
    audio.play();
  };

  const question = questions[currentQ];
  const isLastQuestion = currentQ === questions.length - 1;
  const isScoredType = question.type === 'multiple-choice' || question.type === 'listening';
  // Some unit-3-style quiz questions (fill-blank, matching) get flattened to
  // 'open-ended'/'writing' by the backend's normalize_lesson, but they aren't
  // genuine long-form prompts -- they still carry their original grading data
  // (a short 'correct' string, or a 'pairs' array), which we use to tell them
  // apart from real reflection/essay prompts.
  const isMatchingType = Array.isArray(question.pairs) && question.pairs.length > 0;
  const hasShortCorrect = typeof question.correct === 'string' && question.correct.trim().length > 0;
  const isWritingType = (question.type === 'writing' || question.type === 'open-ended') && !isMatchingType;
  const hasAnswered = isMatchingType
    ? question.pairs.every((_, i) => matchAnswers[currentQ]?.[i])
    : answers[currentQ] !== undefined;

  // Stable shuffled right-side options per question (memoized so they don't
  // reshuffle on every re-render/keystroke).
  const shuffledRightRef = useRef({});
  if (isMatchingType && !shuffledRightRef.current[currentQ]) {
    shuffledRightRef.current[currentQ] = [...question.pairs.map(p => p.right)].sort(() => Math.random() - 0.5);
  }
  const shuffledRight = shuffledRightRef.current[currentQ] || [];

  const handleAnswer = (answerIndex) => {
    setAnswers({ ...answers, [currentQ]: answerIndex });
    setShowFeedback(true);
  };

  const handleTextAnswer = (text) => {
    setAnswers({ ...answers, [currentQ]: text });
  };

  const submitOpenEnded = async () => {
    const text = (answers[currentQ] || '').trim();

    if (hasShortCorrect) {
      // A fill-blank style question (one short correct answer) got relabeled
      // 'open-ended' by the backend normalizer -- grade it like a Pattern
      // Drill blank (flexible/contextual), not like a paragraph. A single
      // word is a complete, valid answer here, so no length minimum.
      if (!text) { setWritingError(true); return; }
      setWritingError(false);
      setAssessing(true);
      try {
        const res = await apiFetch('/api/drill/assess', {
          method: 'POST',
          body: JSON.stringify({ sentence: question.question, scenario: lessonTitle || '', answer: text }),
        });
        const data = res.ok ? await res.json() : null;
        setWritingResults(prev => ({
          ...prev,
          [currentQ]: data
            ? { score: data.correct ? 100 : 0, feedback: data.feedback, feedback_somali: data.feedback_somali }
            : { score: 70, feedback: 'Assessment unavailable — your answer was accepted.', feedback_somali: '' },
        }));
      } catch {
        setWritingResults(prev => ({
          ...prev,
          [currentQ]: { score: 70, feedback: 'Assessment unavailable — your answer was accepted.', feedback_somali: '' },
        }));
      } finally {
        setAssessing(false);
        setShowFeedback(true);
      }
      return;
    }

    // Genuine long-form reflection/essay prompt.
    if (text.length < 20) {
      setWritingError(true);
      return;
    }
    setWritingError(false);
    setAssessing(true);
    try {
      const res = await apiFetch('/api/writing/assess', {
        method: 'POST',
        body: JSON.stringify({
          writing_text: text,
          prompt_instruction: question.question,
          example: '',
          min_words: 15,
        }),
      });
      const data = res.ok ? await res.json() : null;
      setWritingResults(prev => ({
        ...prev,
        [currentQ]: data || { score: 70, feedback: 'Assessment unavailable — your answer was accepted.', feedback_somali: '' },
      }));
    } catch {
      setWritingResults(prev => ({
        ...prev,
        [currentQ]: { score: 70, feedback: 'Assessment unavailable — your answer was accepted.', feedback_somali: '' },
      }));
    } finally {
      setAssessing(false);
      setShowFeedback(true);
    }
  };

  const setMatchAnswer = (leftIdx, rightValue) => {
    setMatchAnswers(prev => ({ ...prev, [currentQ]: { ...(prev[currentQ] || {}), [leftIdx]: rightValue } }));
  };

  const submitMatching = () => {
    const picks = matchAnswers[currentQ] || {};
    let correct = 0;
    question.pairs.forEach((p, i) => { if (picks[i] === p.right) correct++; });
    setMatchResults(prev => ({ ...prev, [currentQ]: { correct, total: question.pairs.length } }));
    setShowFeedback(true);
  };

  const nextQuestion = () => {
    setShowFeedback(false);

    if (isLastQuestion) {
      let correctCount = 0;
      let scoredCount = 0;
      questions.forEach((q, idx) => {
        const qIsMatching = Array.isArray(q.pairs) && q.pairs.length > 0;
        if (q.type === 'multiple-choice' || q.type === 'listening') {
          scoredCount++;
          if (answers[idx] === q.correct) correctCount++;
        } else if (qIsMatching) {
          scoredCount++;
          const mr = matchResults[idx];
          correctCount += mr ? mr.correct / mr.total : 0;
        } else if (q.type === 'writing' || q.type === 'open-ended') {
          scoredCount++;
          correctCount += (writingResults[idx]?.score ?? 70) / 100;
        }
      });

      const finalScore = scoredCount > 0 ? Math.round((correctCount / scoredCount) * 100) : 100;
      setScore(finalScore);
      setQuizComplete(true);

      // Collect wrong scored answers into the mistake notebook (fire-and-forget).
      const wrong = [];
      questions.forEach((q, i) => {
        if ((q.type === 'multiple-choice' || q.type === 'listening') && answers[i] !== q.correct) {
          wrong.push({
            question: q.question,
            correct_answer: q.options?.[q.correct],
            your_answer: answers[i] != null ? q.options?.[answers[i]] : '',
            source: 'quiz',
          });
        }
      });
      if (wrong.length) {
        apiFetch('/api/practice/mistakes', { method: 'POST', body: JSON.stringify({ mistakes: wrong }) }).catch(() => {});
      }
    } else {
      setCurrentQ(currentQ + 1);
    }
  };

  if (quizComplete) {
    const scoredCount = questions.length;

    return (
      <div className="text-center py-12">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
          <Trophy className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Quiz Complete!</h2>
        <p className="text-xl text-gray-600 dark:text-gray-400 mb-2">Your Score: {score}%</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Based on {scoredCount} question{scoredCount !== 1 ? 's' : ''}
        </p>

        <div className="max-w-md mx-auto mb-8">
          {score >= 80 && (
            <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-700 rounded-lg p-4 mb-4">
              <p className="text-green-900 dark:text-green-200 font-semibold">Excellent work!</p>
              <p className="text-green-800 dark:text-green-300 text-sm">You're ready to move forward.</p>
            </div>
          )}

          {score >= 60 && score < 80 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-200 dark:border-yellow-700 rounded-lg p-4 mb-4">
              <p className="text-yellow-900 dark:text-yellow-200 font-semibold">Good effort!</p>
              <p className="text-yellow-800 dark:text-yellow-300 text-sm">Review the sections you struggled with.</p>
            </div>
          )}

          {score < 60 && (
            <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-700 rounded-lg p-4 mb-4">
              <p className="text-red-900 dark:text-red-200 font-semibold">Keep practicing!</p>
              <p className="text-red-800 dark:text-red-300 text-sm">Go through the lesson again before continuing.</p>
            </div>
          )}
        </div>

        <button
          onClick={() => onComplete(score)}
          className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center gap-2 mx-auto"
        >
          Continue to Next Lesson
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Lesson Quiz</h2>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Question {currentQ + 1} of {questions.length}
            <span className="block text-xs font-normal text-gray-400 dark:text-gray-500">Su'aal {currentQ + 1} ee {questions.length}</span>
          </span>
          <div className="flex gap-1">
            {questions.map((_, idx) => (
              <div
                key={idx}
                className={`w-2 h-2 rounded-full ${
                  idx === currentQ
                    ? 'bg-blue-600'
                    : answers[idx] !== undefined
                    ? 'bg-green-600'
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              ></div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{question.question}</h3>
            {somaliQuestions?.[String(question.id ?? currentQ)] && (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic mt-0.5">{somaliQuestions[String(question.id ?? currentQ)]}</p>
            )}
          </div>
          <button
            onClick={() => onRequestHelp({ type: 'question', content: question })}
            className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            title="Get help in Somali"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
        </div>

        {isWritingType && !showFeedback && (
          <div className="mb-4 px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Write a real answer — it will be graded automatically.
            </p>
          </div>
        )}

        {question.type === 'listening' && question.audio && (
          <button
            onClick={() => playAudio(question.audio)}
            className="w-full py-3 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg font-semibold hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors flex items-center justify-center gap-2 mb-4"
          >
            <Volume2 className="w-5 h-5" />
            Play Audio
          </button>
        )}

        {isMatchingType && (
          <div className="space-y-3">
            {question.pairs.map((pair, i) => {
              const picked = matchAnswers[currentQ]?.[i];
              const isCorrect = picked === pair.right;
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-1/3 font-medium text-gray-900 dark:text-white">{pair.left}</span>
                  <select
                    value={picked || ''}
                    onChange={(e) => setMatchAnswer(i, e.target.value)}
                    disabled={showFeedback}
                    className={`flex-1 p-3 rounded-lg border-2 ${
                      showFeedback
                        ? isCorrect
                          ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-900 dark:text-green-200'
                          : 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-900 dark:text-red-200'
                        : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white'
                    }`}
                  >
                    <option value="" disabled>Choose a match...</option>
                    {shuffledRight.map((opt, oi) => (
                      <option key={oi} value={opt}>{opt}</option>
                    ))}
                  </select>
                  {showFeedback && (isCorrect
                    ? <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                    : <X className="w-5 h-5 text-red-600 flex-shrink-0" />
                  )}
                </div>
              );
            })}
            {showFeedback && matchResults[currentQ] && (
              <p className="text-sm text-gray-600 dark:text-gray-400 pt-1">
                {matchResults[currentQ].correct} of {matchResults[currentQ].total} correct
              </p>
            )}
          </div>
        )}

        {(question.type === 'multiple-choice' || question.type === 'listening') && (
          <div className="space-y-3">
            {question.options.map((option, idx) => {
              const isSelected = answers[currentQ] === idx;
              const isCorrect = idx === question.correct;
              const showCorrectness = showFeedback;

              return (
                <button
                  key={idx}
                  onClick={() => !showFeedback && handleAnswer(idx)}
                  disabled={showFeedback}
                  className={`w-full p-4 rounded-lg text-left transition-all ${
                    showCorrectness
                      ? isCorrect
                        ? 'bg-green-100 dark:bg-green-900/30 border-2 border-green-500 text-green-900 dark:text-green-200'
                        : isSelected
                        ? 'bg-red-100 dark:bg-red-900/30 border-2 border-red-500 text-red-900 dark:text-red-200'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                      : isSelected
                      ? 'bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-500 text-blue-900 dark:text-blue-200'
                      : 'bg-gray-50 dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 text-gray-900 dark:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{option}</span>
                    {showCorrectness && isCorrect && <Check className="w-5 h-5 text-green-600" />}
                    {showCorrectness && isSelected && !isCorrect && <X className="w-5 h-5 text-red-600" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {isWritingType && hasShortCorrect && (
          <div>
            <input
              type="text"
              value={answers[currentQ] || ''}
              onChange={(e) => { handleTextAnswer(e.target.value); setWritingError(false); }}
              placeholder="Type your answer..."
              className="w-full p-4 border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none text-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 placeholder-gray-400 dark:placeholder-gray-500"
            />
            {writingError && (
              <p className="mt-1 text-sm text-red-500 dark:text-red-400">Please write an answer.</p>
            )}
          </div>
        )}

        {isWritingType && !hasShortCorrect && (
          <div>
            <textarea
              value={answers[currentQ] || ''}
              onChange={(e) => { handleTextAnswer(e.target.value); setWritingError(false); }}
              placeholder="Write your answer here..."
              className="w-full p-4 border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none min-h-[150px] text-gray-900 dark:text-white bg-white dark:bg-gray-700 placeholder-gray-400 dark:placeholder-gray-500"
            />
            {writingError && (
              <p className="mt-1 text-sm text-red-500 dark:text-red-400">Please write at least 20 characters.</p>
            )}
          </div>
        )}

        {showFeedback && question.explanation && (
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-600 rounded">
            <p className="text-sm text-blue-900 dark:text-blue-300">
              <strong>Explanation:</strong> {question.explanation}
            </p>
            {somaliExplanations?.[String(question.id ?? currentQ)] && (
              <p className="text-sm text-blue-800 dark:text-blue-300/80 italic mt-2">
                {somaliExplanations[String(question.id ?? currentQ)]}
              </p>
            )}
          </div>
        )}

        {isWritingType && showFeedback && writingResults[currentQ] && (
          <div className="mt-4 space-y-2">
            <div className={`p-4 rounded-lg border-l-4 ${
              writingResults[currentQ].score >= 60
                ? 'bg-green-50 dark:bg-green-900/20 border-green-500'
                : 'bg-amber-50 dark:bg-amber-900/20 border-amber-500'
            }`}>
              <p className={`text-sm font-bold mb-1 ${
                writingResults[currentQ].score >= 60
                  ? 'text-green-900 dark:text-green-300'
                  : 'text-amber-900 dark:text-amber-300'
              }`}>
                {writingResults[currentQ].score}/100
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{writingResults[currentQ].feedback}</p>
              {writingResults[currentQ].feedback_somali && (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic mt-1">{writingResults[currentQ].feedback_somali}</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex gap-4">
        {currentQ > 0 && !showFeedback && (
          <button
            onClick={() => setCurrentQ(currentQ - 1)}
            className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Previous
          </button>
        )}

        {showFeedback ? (
          <button
            onClick={nextQuestion}
            className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
          >
            {isLastQuestion ? 'Complete Quiz' : 'Next Question'}
            <ChevronRight className="w-5 h-5" />
          </button>
        ) : (
          <button
            onClick={() => {
              if (isWritingType) submitOpenEnded();
              else if (isMatchingType) submitMatching();
            }}
            disabled={!hasAnswered || assessing}
            className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isScoredType || isMatchingType
              ? 'Submit Answer'
              : assessing ? 'Grading...' : 'Submit for Grading'}
          </button>
        )}
      </div>
    </div>
  );
}
