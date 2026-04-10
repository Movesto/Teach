import React from 'react';
import { CheckCircle, Circle, AlertCircle } from 'lucide-react';

/**
 * QuestionInterface Component
 * Displays comprehension questions with multiple choice, true/false, and short answer
 */
function QuestionInterface({ questions, answers, onAnswerChange }) {
  // Calculate progress
  const totalQuestions = questions.length;
  const answeredQuestions = Object.keys(answers).filter(
    key => answers[key] !== undefined && answers[key] !== null && answers[key] !== ''
  ).length;


  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-bold">Comprehension Questions</h3>
          <span className="text-sm text-gray-600">
            {answeredQuestions} of {totalQuestions} answered
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-500 h-2 rounded-full transition-all"
            style={{ width: totalQuestions > 0 ? `${(answeredQuestions / totalQuestions) * 100}%` : '0%' }}
          ></div>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
        <h4 className="font-semibold mb-2">📝 Instructions:</h4>
        <ul className="text-sm text-gray-700 space-y-1">
          <li>• Answer all {totalQuestions} questions about the book you read</li>
          <li>• You can refer back to the book while answering</li>
          <li>• Multiple choice and true/false are auto-graded</li>
          <li>• Short answer questions will be reviewed by your teacher</li>
          <li>• Take your time and think carefully about each answer</li>
        </ul>
      </div>

      {/* Questions List */}
      <div className="space-y-6">
        {questions.map((question, idx) => (
          <QuestionCard
            key={question.id}
            question={question}
            index={idx}
            answer={answers[question.id]}
            onAnswerChange={(value) => onAnswerChange(question.id, value)}
          />
        ))}
      </div>

      {/* Bottom Progress Reminder */}
      {answeredQuestions < totalQuestions && (
        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
          <div className="flex items-start gap-2">
            <AlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-semibold text-yellow-800">
                {totalQuestions - answeredQuestions} question{totalQuestions - answeredQuestions !== 1 ? 's' : ''} remaining
              </p>
              <p className="text-sm text-yellow-700">
                Make sure to answer all questions before submitting your assignment.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Individual Question Card Component
 */
function QuestionCard({ question, index, answer, onAnswerChange }) {
  const isAnswered = answer !== undefined && answer !== null && answer !== '';

  const getDifficultyColor = (difficulty) => {
    const colors = {
      'easy': 'bg-green-100 text-green-800',
      'medium': 'bg-yellow-100 text-yellow-800',
      'hard': 'bg-red-100 text-red-800'
    };
    return colors[difficulty] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className={`bg-white rounded-lg shadow-lg p-6 border-2 ${
      isAnswered ? 'border-green-200' : 'border-gray-200'
    }`}>
      {/* Question Header */}
      <div className="flex items-start gap-3 mb-4">
        <div className="flex-shrink-0">
          {isAnswered ? (
            <CheckCircle className="text-green-500" size={24} />
          ) : (
            <Circle className="text-gray-300" size={24} />
          )}
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-lg font-bold text-gray-400">Question {index + 1}</span>
            <span className={`px-2 py-1 rounded text-xs ${getDifficultyColor(question.difficulty)}`}>
              {question.difficulty}
            </span>
            {question.chapter && (
              <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                {question.chapter}
              </span>
            )}
          </div>

          <h4 className="text-lg font-semibold text-gray-800 leading-relaxed">
            {question.question}
          </h4>
        </div>
      </div>

      {/* Answer Options */}
      <div className="ml-9">
        {/* Multiple Choice */}
        {question.type === 'multiple-choice' && (
          <div className="space-y-2">
            {question.options.map((option, optIdx) => (
              <label
                key={optIdx}
                className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all hover:bg-gray-50 ${
                  answer === optIdx
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200'
                }`}
              >
                <input
                  type="radio"
                  name={question.id}
                  checked={answer === optIdx}
                  onChange={() => onAnswerChange(optIdx)}
                  className="w-4 h-4 text-blue-500 mr-3"
                />
                <span className="flex-1 text-gray-800">{option}</span>
              </label>
            ))}
          </div>
        )}

        {/* True/False */}
        {question.type === 'true-false' && (
          <div className="space-y-2">
            <label
              className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all hover:bg-gray-50 ${
                answer === true || answer === 1
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200'
              }`}
            >
              <input
                type="radio"
                name={question.id}
                checked={answer === true || answer === 1}
                onChange={() => onAnswerChange(1)}
                className="w-4 h-4 text-blue-500 mr-3"
              />
              <span className="flex-1 text-gray-800 font-semibold">True</span>
            </label>

            <label
              className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all hover:bg-gray-50 ${
                answer === false || answer === 0
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200'
              }`}
            >
              <input
                type="radio"
                name={question.id}
                checked={answer === false || answer === 0}
                onChange={() => onAnswerChange(0)}
                className="w-4 h-4 text-blue-500 mr-3"
              />
              <span className="flex-1 text-gray-800 font-semibold">False</span>
            </label>
          </div>
        )}

        {/* Short Answer */}
        {question.type === 'short-answer' && (
          <div>
            <textarea
              value={answer || ''}
              onChange={(e) => onAnswerChange(e.target.value)}
              placeholder="Type your answer here... (Write at least 2-3 complete sentences)"
              className="w-full p-4 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none min-h-32"
              rows="5"
            />
            <div className="flex justify-between items-center mt-2 text-sm">
              <span className="text-gray-500">
                This will be reviewed by your teacher
              </span>
              <span className={`${
                answer && answer.split(' ').length >= 10
                  ? 'text-green-600'
                  : 'text-gray-500'
              }`}>
                {answer ? answer.split(' ').filter(w => w.length > 0).length : 0} words
                {answer && answer.split(' ').length < 10 && ' (aim for 10+)'}
              </span>
            </div>
          </div>
        )}

        {/* Helpful Hint if Available */}
        {question.hint && !isAnswered && (
          <div className="mt-3 p-3 bg-gray-50 rounded border-l-4 border-gray-300">
            <p className="text-sm text-gray-600">
              <strong>💡 Hint:</strong> {question.hint}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default QuestionInterface;
