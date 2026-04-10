import React, { useState, useMemo } from 'react';
import { FileText, CheckCircle, AlertCircle, Info, Circle } from 'lucide-react';

/**
 * WritingInterface Component
 * Displays writing prompts and provides essay writing interface with real-time feedback
 */
function WritingInterface({ prompts, essays, onEssayChange }) {
  // Calculate progress
  const totalPrompts = prompts.length;
  const completedPrompts = Object.values(essays).filter(
    essay => essay && essay.trim().length > 0
  ).length;

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-lg font-bold">Writing Assignments</h3>
          <span className="text-sm text-gray-600">
            {completedPrompts} of {totalPrompts} completed
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-green-500 h-2 rounded-full transition-all"
            style={{ width: `${(completedPrompts / totalPrompts) * 100}%` }}
          ></div>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
        <h4 className="font-semibold mb-2">✍️ Writing Instructions:</h4>
        <ul className="text-sm text-gray-700 space-y-1">
          <li>• Complete {totalPrompts} writing assignment{totalPrompts !== 1 ? 's' : ''} based on the book</li>
          <li>• Follow the word count requirements for each prompt</li>
          <li>• Use specific examples and quotes from the book</li>
          <li>• Check your grammar and spelling before submitting</li>
          <li>• Your teacher will review and provide detailed feedback</li>
        </ul>
      </div>

      {/* Writing Prompts */}
      <div className="space-y-8">
        {prompts.map((prompt, idx) => (
          <WritingPromptCard
            key={prompt.id}
            prompt={prompt}
            index={idx}
            essay={essays[prompt.id] || ''}
            onEssayChange={(text) => onEssayChange(prompt.id, text)}
          />
        ))}
      </div>

      {/* Bottom Reminder */}
      {completedPrompts < totalPrompts && (
        <div className="bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
          <div className="flex items-start gap-2">
            <AlertCircle className="text-yellow-600 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="font-semibold text-yellow-800">
                {totalPrompts - completedPrompts} essay{totalPrompts - completedPrompts !== 1 ? 's' : ''} remaining
              </p>
              <p className="text-sm text-yellow-700">
                Complete all writing assignments before submitting.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Individual Writing Prompt Card
 */
function WritingPromptCard({ prompt, index, essay, onEssayChange }) {
  const wordCount = useMemo(() => essay.trim().split(/\s+/).filter(w => w.length > 0).length, [essay]);
  const [showRubric, setShowRubric] = useState(false);

  // Check if meets requirements
  const meetsMinimum = wordCount >= prompt.word_count_min;
  const meetsMaximum = wordCount <= prompt.word_count_max;
  const meetsRequirements = meetsMinimum && meetsMaximum;
  const isStarted = essay.trim().length > 0;

  // Get difficulty color
  const getDifficultyColor = (difficulty) => {
    const colors = {
      'easy': 'bg-green-100 text-green-800',
      'medium': 'bg-yellow-100 text-yellow-800',
      'hard': 'bg-red-100 text-red-800'
    };
    return colors[difficulty] || 'bg-gray-100 text-gray-800';
  };

  // Word count status
  const getWordCountStatus = () => {
    if (!isStarted) return { color: 'text-gray-500', message: 'Not started' };
    if (!meetsMinimum) return { color: 'text-orange-600', message: `Need ${prompt.word_count_min - wordCount} more words` };
    if (!meetsMaximum) return { color: 'text-red-600', message: `${wordCount - prompt.word_count_max} words over limit` };
    return { color: 'text-green-600', message: '✓ Perfect length' };
  };

  const wordCountStatus = getWordCountStatus();

  return (
    <div className={`bg-white rounded-lg shadow-lg border-2 ${
      meetsRequirements && isStarted ? 'border-green-200' : 'border-gray-200'
    }`}>
      {/* Prompt Header */}
      <div className="p-6 border-b">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0">
              {meetsRequirements && isStarted ? (
                <CheckCircle className="text-green-500" size={28} />
              ) : (
                <FileText className="text-gray-400" size={28} />
              )}
            </div>
            <div>
              <h4 className="text-xl font-bold text-gray-800">
                Essay {index + 1}
              </h4>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-gray-600">{prompt.type}</span>
                <span className={`px-2 py-1 rounded text-xs ${getDifficultyColor(prompt.difficulty)}`}>
                  {prompt.difficulty}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => setShowRubric(!showRubric)}
            className="flex items-center gap-1 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
          >
            <Info size={16} />
            {showRubric ? 'Hide' : 'Show'} Rubric
          </button>
        </div>

        {/* Prompt Text */}
        <div className="bg-gray-50 rounded-lg p-4 mt-4">
          <p className="text-gray-800 leading-relaxed whitespace-pre-line">
            {prompt.prompt}
          </p>
        </div>

        {/* Requirements */}
        <div className="mt-4 flex flex-wrap items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-700">Required:</span>
            <span className="text-gray-600">
              {prompt.word_count_min}-{prompt.word_count_max} words
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-700">Points:</span>
            <span className="text-gray-600">{prompt.points} points</span>
          </div>
        </div>

        {/* Rubric */}
        {showRubric && prompt.rubric && (
          <div className="mt-4 bg-blue-50 rounded-lg p-4">
            <h5 className="font-semibold text-blue-900 mb-3">Grading Rubric:</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {Object.entries(prompt.rubric).map(([criterion, points]) => (
                <div key={criterion} className="flex justify-between items-center">
                  <span className="text-sm text-gray-700 capitalize">
                    {criterion.replace(/_/g, ' ')}:
                  </span>
                  <span className="text-sm font-semibold text-blue-700">
                    {points} pts
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Writing Area */}
      <div className="p-6">
        <textarea
          value={essay}
          onChange={(e) => onEssayChange(e.target.value)}
          placeholder="Start writing your essay here...

Remember to:
• Answer the prompt completely
• Use specific examples from the book
• Organize your thoughts into paragraphs
• Proofread for grammar and spelling
• Meet the word count requirement"
          className="w-full p-4 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none font-serif text-base leading-relaxed resize-none"
          rows="20"
          style={{ minHeight: '500px' }}
        />

        {/* Writing Stats */}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 p-4 bg-gray-50 rounded-lg">
          {/* Word Count */}
          <div className="flex items-center gap-4">
            <div>
              <span className="text-2xl font-bold text-gray-800">{wordCount}</span>
              <span className="text-sm text-gray-600 ml-1">words</span>
            </div>
            <div className="h-8 w-px bg-gray-300"></div>
            <div className={`text-sm font-semibold ${wordCountStatus.color}`}>
              {wordCountStatus.message}
            </div>
          </div>

          {/* Progress Indicators */}
          <div className="flex items-center gap-3 text-sm">
            {isStarted && (
              <>
                <div className={`flex items-center gap-1 ${meetsMinimum ? 'text-green-600' : 'text-gray-400'}`}>
                  {meetsMinimum ? <CheckCircle size={16} /> : <Circle size={16} />}
                  <span>Minimum met</span>
                </div>
                <div className={`flex items-center gap-1 ${meetsMaximum ? 'text-green-600' : 'text-gray-400'}`}>
                  {meetsMaximum ? <CheckCircle size={16} /> : <Circle size={16} />}
                  <span>Under maximum</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Writing Tips */}
        {!isStarted && (
          <div className="mt-4 bg-purple-50 border-l-4 border-purple-500 p-4 rounded">
            <h5 className="font-semibold text-purple-900 mb-2">💡 Writing Tips:</h5>
            <ul className="text-sm text-purple-800 space-y-1">
              <li>• Start with a clear introduction that addresses the prompt</li>
              <li>• Use quotes or specific examples from the book to support your points</li>
              <li>• Organize your ideas into 3-5 paragraphs</li>
              <li>• End with a conclusion that summarizes your main points</li>
              <li>• Save your work frequently (it auto-saves!)</li>
            </ul>
          </div>
        )}

        {/* Progress Warning */}
        {isStarted && !meetsRequirements && (
          <div className="mt-4 bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded">
            <p className="text-sm text-yellow-800">
              {!meetsMinimum && `⚠️ Your essay needs ${prompt.word_count_min - wordCount} more words to meet the minimum requirement.`}
              {!meetsMaximum && `⚠️ Your essay is ${wordCount - prompt.word_count_max} words over the maximum. Please edit to shorten it.`}
            </p>
          </div>
        )}

        {/* Success Message */}
        {meetsRequirements && isStarted && (
          <div className="mt-4 bg-green-50 border-l-4 border-green-500 p-4 rounded">
            <p className="text-sm text-green-800">
              ✓ Great work! Your essay meets all requirements. Review it carefully before submitting.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default WritingInterface;
