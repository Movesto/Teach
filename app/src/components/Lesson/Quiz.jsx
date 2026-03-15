import { useState } from 'react';
import { Check, X, Volume2, ChevronRight, Trophy, HelpCircle } from 'lucide-react';

export function Quiz({ questions, lessonId, onComplete, onRequestHelp }) {
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showFeedback, setShowFeedback] = useState(false);
  const [quizComplete, setQuizComplete] = useState(false);
  const [score, setScore] = useState(0);

  const question = questions[currentQ];
  const isLastQuestion = currentQ === questions.length - 1;
  const hasAnswered = answers[currentQ] !== undefined;
  const isScoredType = question.type === 'multiple-choice' || question.type === 'listening';

  const handleAnswer = (answerIndex) => {
    setAnswers({ ...answers, [currentQ]: answerIndex });
    setShowFeedback(true);
  };

  const handleTextAnswer = (text) => {
    setAnswers({ ...answers, [currentQ]: text });
  };

  const nextQuestion = () => {
    setShowFeedback(false);

    if (isLastQuestion) {
      let correctCount = 0;
      let scoredCount = 0;
      questions.forEach((q, idx) => {
        if (q.type === 'multiple-choice' || q.type === 'listening') {
          scoredCount++;
          if (answers[idx] === q.correct) correctCount++;
        }
      });

      const finalScore = scoredCount > 0 ? Math.round((correctCount / scoredCount) * 100) : 100;
      setScore(finalScore);
      setQuizComplete(true);
    } else {
      setCurrentQ(currentQ + 1);
    }
  };

  if (quizComplete) {
    const scoredCount = questions.filter(q => q.type === 'multiple-choice' || q.type === 'listening').length;
    const practiceCount = questions.filter(q => q.type === 'writing' || q.type === 'open-ended').length;

    return (
      <div className="text-center py-12">
        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center">
          <Trophy className="w-10 h-10 text-white" />
        </div>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Quiz Complete!</h2>
        <p className="text-xl text-gray-600 dark:text-gray-400 mb-2">Your Score: {score}%</p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
          Based on {scoredCount} scored question{scoredCount !== 1 ? 's' : ''}
          {practiceCount > 0 && ` (${practiceCount} writing/reflection question${practiceCount !== 1 ? 's' : ''} not scored)`}
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
          className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
        >
          Continue to Next Lesson
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
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{question.question}</h3>
          <button
            onClick={() => onRequestHelp({ type: 'question', content: question })}
            className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            title="Get help in Somali"
          >
            <HelpCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Not-scored badge for writing/open-ended */}
        {!isScoredType && (
          <div className="mb-4 px-3 py-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Writing answers are for practice — not scored.
            </p>
          </div>
        )}

        {question.type === 'listening' && question.audio && (
          <button
            onClick={() => new Audio(question.audio).play()}
            className="w-full py-3 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg font-semibold hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors flex items-center justify-center gap-2 mb-4"
          >
            <Volume2 className="w-5 h-5" />
            Play Audio
          </button>
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

        {(question.type === 'open-ended' || question.type === 'writing') && (
          <div>
            <textarea
              value={answers[currentQ] || ''}
              onChange={(e) => handleTextAnswer(e.target.value)}
              placeholder="Write your answer here..."
              className="w-full p-4 border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none min-h-[150px] text-gray-900 dark:text-white bg-white dark:bg-gray-700 placeholder-gray-400 dark:placeholder-gray-500"
            />
          </div>
        )}

        {showFeedback && question.explanation && (
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-600 rounded">
            <p className="text-sm text-blue-900 dark:text-blue-300">
              <strong>Explanation:</strong> {question.explanation}
            </p>
          </div>
        )}

        {!isScoredType && showFeedback && (
          <div className="mt-4 space-y-2">
            {question.correct && (
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 rounded">
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-1">Model answer:</p>
                <p className="text-sm text-blue-800 dark:text-blue-200">{question.correct}</p>
              </div>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400">This question is for practice — not scored.</p>
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
              if (question.type === 'open-ended' || question.type === 'writing') {
                if (answers[currentQ] && answers[currentQ].length > 20) {
                  setShowFeedback(true);
                } else {
                  alert('Please write at least 20 characters.');
                }
              }
            }}
            disabled={!hasAnswered}
            className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isScoredType
              ? 'Submit Answer'
              : 'Submit & Continue'}
          </button>
        )}
      </div>
    </div>
  );
}
