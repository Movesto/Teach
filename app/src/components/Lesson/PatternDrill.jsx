import { useState, useRef } from 'react';
import { ChevronRight, Check, X } from 'lucide-react';
import { apiFetch } from '../../utils/api';

export function PatternDrill({ drills, lessonTitle, onComplete, onRequestHelp }) {
  const [currentDrill, setCurrentDrill] = useState(0);
  const [currentPrompt, setCurrentPrompt] = useState(0);
  const [promptInput, setPromptInput] = useState('');
  const [promptFeedback, setPromptFeedback] = useState(null);
  const [drillFeedbackText, setDrillFeedbackText] = useState('');
  const [checkingAnswer, setCheckingAnswer] = useState(false);
  const [completedPrompts, setCompletedPrompts] = useState({});
  const [promptsComplete, setPromptsComplete] = useState(false);
  const inputRef = useRef(null);

  const drill = drills[currentDrill];
  const isLastDrill = currentDrill === drills.length - 1;
  const hasPrompts = drill.prompts && drill.prompts.length > 0;

  const normalizePunctuation = (s) =>
    s.trim().toLowerCase().replace(/[.,!?;:'"()-]/g, '').replace(/\s+/g, ' ').trim();

  const handlePromptSubmit = async () => {
    if (!promptInput.trim() || checkingAnswer) return;
    const prompt = drill.prompts[currentPrompt];

    if (prompt.type === 'open') {
      setPromptFeedback('open');
      return;
    }

    if (prompt.type === 'flexible') {
      setCheckingAnswer(true);
      try {
        const res = await apiFetch('/api/drill/assess', {
          method: 'POST',
          body: JSON.stringify({ sentence: prompt.sentence, scenario: lessonTitle || '', answer: promptInput }),
        });
        const data = await res.json();
        setDrillFeedbackText(data.feedback || '');
        setPromptFeedback(data.correct ? 'correct' : 'wrong');
      } catch {
        setDrillFeedbackText('');
        setPromptFeedback('correct'); // don't block the lesson if grading is unreachable
      } finally {
        setCheckingAnswer(false);
      }
      return;
    }

    const correct = normalizePunctuation(promptInput) === normalizePunctuation(prompt.answer);
    setPromptFeedback(correct ? 'correct' : 'wrong');
  };

  const handlePromptNext = () => {
    const nextPrompt = currentPrompt + 1;
    const done = (completedPrompts[currentDrill] || 0) + 1;
    setCompletedPrompts({ ...completedPrompts, [currentDrill]: done });
    setPromptInput('');
    setPromptFeedback(null);
    setDrillFeedbackText('');

    if (nextPrompt >= drill.prompts.length) {
      setPromptsComplete(true);
    } else {
      setCurrentPrompt(nextPrompt);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (promptFeedback) {
        handlePromptNext();
      } else {
        handlePromptSubmit();
      }
    }
  };

  const nextDrill = () => {
    if (isLastDrill) {
      onComplete();
    } else {
      setCurrentDrill(currentDrill + 1);
      setCurrentPrompt(0);
      setPromptInput('');
      setPromptFeedback(null);
      setDrillFeedbackText('');
      setPromptsComplete(false);
    }
  };

  const renderSentence = (sentence, answer, showAnswer) => {
    const parts = sentence.split('___');
    return (
      <span className="text-xl">
        {parts[0]}
        <span className={`inline-block min-w-[80px] border-b-2 text-center font-bold ${
          showAnswer ? 'border-green-500 text-green-700 dark:text-green-400' : 'border-blue-500 text-blue-700 dark:text-blue-400'
        }`}>
          {showAnswer ? answer : '___'}
        </span>
        {parts[1]}
      </span>
    );
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Pattern Drills</h2>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
            Drill {currentDrill + 1} of {drills.length}
          </span>
          <div className="flex gap-1">
            {drills.map((_, idx) => (
              <div
                key={idx}
                className={`w-2 h-2 rounded-full ${
                  idx === currentDrill
                    ? 'bg-blue-600'
                    : idx < currentDrill
                    ? 'bg-green-600'
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              ></div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-blue-900 dark:text-blue-200 mb-4">{drill.title}</h3>
        <p className="text-blue-800 dark:text-blue-300 mb-4">{drill.instruction}</p>

        {/* Interactive prompts mode */}
        {hasPrompts && !promptsComplete && (
          <div>
            {/* Prompt progress */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Prompt {currentPrompt + 1} of {drill.prompts.length}
              </span>
              <div className="flex gap-1">
                {drill.prompts.map((_, idx) => (
                  <div
                    key={idx}
                    className={`w-2 h-2 rounded-full ${
                      idx === currentPrompt
                        ? 'bg-blue-600'
                        : idx < currentPrompt
                        ? 'bg-green-600'
                        : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  ></div>
                ))}
              </div>
            </div>

            {/* Sentence with blank, or open question */}
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-blue-200 dark:border-blue-700 mb-4 text-center">
              {drill.prompts[currentPrompt].type === 'open'
                ? <span className="text-xl text-gray-900 dark:text-white">{drill.prompts[currentPrompt].question}</span>
                : renderSentence(
                    drill.prompts[currentPrompt].sentence,
                    drill.prompts[currentPrompt].type === 'flexible' ? promptInput : drill.prompts[currentPrompt].answer,
                    promptFeedback === 'correct'
                  )
              }
            </div>

            {/* Input and submit */}
            {promptFeedback === null && (
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={drill.prompts[currentPrompt].type === 'open' ? 'Write your answer...' : 'Type the missing word...'}
                  autoFocus
                  className="min-w-0 flex-1 px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none text-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                />
                <button
                  onClick={handlePromptSubmit}
                  disabled={!promptInput.trim() || checkingAnswer}
                  className="w-full sm:w-auto px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {checkingAnswer ? 'Checking...' : 'Check'}
                </button>
              </div>
            )}

            {/* Feedback */}
            {promptFeedback === 'open' && (
              <div className="bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-300 dark:border-blue-700 rounded-lg p-4 mb-4">
                <p className="text-sm text-blue-900 dark:text-blue-300 mb-1">
                  <span className="font-semibold">Your answer:</span> {promptInput}
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-400 italic">
                  Example answer: {drill.prompts[currentPrompt].model_answer}
                </p>
                <button
                  onClick={handlePromptNext}
                  autoFocus
                  className="mt-3 px-6 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                  {currentPrompt + 1 >= drill.prompts.length ? 'Finish' : 'Next'}
                </button>
              </div>
            )}

            {promptFeedback === 'correct' && (
              <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-300 dark:border-green-700 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Check className="w-6 h-6 text-green-600" />
                  <span className="font-bold text-green-800 dark:text-green-300 text-lg">Correct!</span>
                </div>
                {drillFeedbackText && (
                  <p className="text-green-700 dark:text-green-400 text-sm">{drillFeedbackText}</p>
                )}
                <button
                  onClick={handlePromptNext}
                  autoFocus
                  className="mt-2 px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
                >
                  {currentPrompt + 1 >= drill.prompts.length ? 'Finish' : 'Next'}
                </button>
              </div>
            )}

            {promptFeedback === 'wrong' && (
              <div className="bg-red-50 dark:bg-red-900/20 border-2 border-red-300 dark:border-red-700 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <X className="w-6 h-6 text-red-600" />
                  <span className="font-bold text-red-800 dark:text-red-300 text-lg">Not quite</span>
                </div>
                <p className="text-red-700 dark:text-red-400">
                  {drill.prompts[currentPrompt].type === 'flexible'
                    ? (drillFeedbackText || "That doesn't quite fit — try again next time.")
                    : <>The correct answer is: <strong>{drill.prompts[currentPrompt].answer}</strong></>
                  }
                </p>
                <button
                  onClick={handlePromptNext}
                  autoFocus
                  className="mt-2 px-6 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
                >
                  {currentPrompt + 1 >= drill.prompts.length ? 'Finish' : 'Next'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Passive mode fallback (no prompts) — show examples list */}
        {!hasPrompts && (
          <div className="space-y-3 mb-6">
            {drill.examples.map((example, idx) => (
              <div key={idx} className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-blue-200 dark:border-blue-700">
                <p className="text-gray-800 dark:text-gray-200 font-medium">{example}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-4">
        {currentDrill > 0 && (
          <button
            onClick={() => {
              setCurrentDrill(currentDrill - 1);
              setCurrentPrompt(0);
              setPromptInput('');
              setPromptFeedback(null);
              setPromptsComplete(false);
            }}
            className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Previous Drill
          </button>
        )}
        <button
          onClick={nextDrill}
          disabled={hasPrompts && !promptsComplete}
          className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLastDrill ? 'Complete Drills' : 'Next Drill'}
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <button
        onClick={() => onRequestHelp({ type: 'drill', content: drill })}
        className="mt-4 text-blue-600 dark:text-blue-400 hover:underline text-sm"
      >
        Need help understanding this pattern?
      </button>
    </div>
  );
}
