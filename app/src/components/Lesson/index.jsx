import { ChevronRight } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { Volume2, Mic, Check, X } from 'lucide-react';

// StorySection Component
export function StorySection({ story, onComplete, onRequestHelp }) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-4">The Situation</h2>
      
      {story.context && (
        <div className="bg-blue-50 border-l-4 border-blue-600 p-4 mb-6">
          <p className="text-blue-900 font-semibold mb-1">Context:</p>
          <p className="text-blue-800">{story.context}</p>
        </div>
      )}

      <div className="prose max-w-none mb-6">
        {story.dialogue?.map((line, idx) => (
          <div key={idx} className="mb-6">
            <p className="font-bold text-gray-900 mb-1">{line.speaker}:</p>
            <p className="text-gray-800 text-lg ml-4 leading-relaxed">{line.text}</p>
          </div>
        ))}
      </div>

      <button
        onClick={onComplete}
        className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
      >
        Continue to Reading Practice
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}

// ListeningExercise Component
export function ListeningExercise({ exercises, onComplete, onRequestHelp }) {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [showFeedback, setShowFeedback] = useState(false);

  const exercise = exercises[current];
  const isLast = current === exercises.length - 1;

  const playAudio = () => {
    const audio = new Audio(exercise.audio);
    audio.play();
  };

  const handleAnswer = (idx) => {
    setAnswers({ ...answers, [current]: idx });
    setShowFeedback(true);
  };

  const next = () => {
    setShowFeedback(false);
    if (isLast) {
      onComplete();
    } else {
      setCurrent(current + 1);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Listening Practice</h2>

      <div className="mb-4 text-sm text-gray-600">
        Exercise {current + 1} of {exercises.length}
      </div>

      <div className="bg-white border-2 border-gray-200 rounded-lg p-6 mb-6">
        <p className="text-gray-900 font-semibold mb-4">{exercise.question}</p>
        
        <button
          onClick={playAudio}
          className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 mb-6"
        >
          <Volume2 className="w-5 h-5" />
          Play Audio
        </button>

        <div className="space-y-3">
          {exercise.options.map((option, idx) => {
            const isSelected = answers[current] === idx;
            const isCorrect = idx === exercise.correct;
            
            return (
              <button
                key={idx}
                onClick={() => !showFeedback && handleAnswer(idx)}
                disabled={showFeedback}
                className={`w-full p-4 rounded-lg text-left transition-all ${
                  showFeedback
                    ? isCorrect
                      ? 'bg-green-100 border-2 border-green-500'
                      : isSelected
                      ? 'bg-red-100 border-2 border-red-500'
                      : 'bg-gray-100'
                    : isSelected
                    ? 'bg-blue-100 border-2 border-blue-500'
                    : 'bg-gray-50 border-2 border-gray-200 hover:border-blue-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span>{option}</span>
                  {showFeedback && isCorrect && <Check className="w-5 h-5 text-green-600" />}
                  {showFeedback && isSelected && !isCorrect && <X className="w-5 h-5 text-red-600" />}
                </div>
              </button>
            );
          })}
        </div>

        {showFeedback && exercise.explanation && (
          <div className="mt-4 p-4 bg-blue-50 border-l-4 border-blue-600 rounded">
            <p className="text-sm text-blue-900">{exercise.explanation}</p>
          </div>
        )}
      </div>

      {showFeedback && (
        <button
          onClick={next}
          className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
        >
          {isLast ? 'Complete Listening Exercises' : 'Next Exercise'}
        </button>
      )}
    </div>
  );
}

// SpeakingRecorder Component
export function SpeakingRecorder({ tasks, onComplete, onRequestHelp }) {
  const [current, setCurrent] = useState(0);
  const [recordings, setRecordings] = useState({});
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const [pronunciationResult, setPronunciationResult] = useState({})
  const [isAssessing, setIsAssessing] = useState(false)

  const task = tasks[current];
  const isLast = current === tasks.length - 1;

  const startRecording = async () => {
    const taskIndex = current;
    const expectedText = tasks[current].example || tasks[current].instruction || '';
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setRecordings({ ...recordings, [taskIndex]: url });
        stream.getTracks().forEach(t => t.stop());

        if (expectedText) {
          const formData = new FormData()
          formData.append('audio', blob, 'recording.webm')
          formData.append('language', 'english')
          formData.append('expected_text', expectedText)
          setIsAssessing(true)
          fetch('/api/pronunciation/assess', { method: 'POST', body: formData })
            .then(r => r.json())
            .then(result => {
              setPronunciationResult(prev => ({ ...prev, [taskIndex]: result }))
              setIsAssessing(false)
            })
            .catch(() => setIsAssessing(false))
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      alert('Microphone access denied. Please enable microphone permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const playRecording = () => {
    if (recordings[current]) {
      new Audio(recordings[current]).play();
    }
  };

  const next = () => {
    if (isLast) {
      onComplete();
    } else {
      setCurrent(current + 1);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Speaking Practice</h2>

      <div className="mb-4 text-sm text-gray-600">
        Task {current + 1} of {tasks.length}
      </div>

      <div className="bg-white border-2 border-gray-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-gray-900 mb-2">{task.title}</h3>
        <p className="text-gray-700 mb-4">{task.instruction}</p>

        {task.example && (
          <div className="bg-blue-50 rounded-lg p-4 mb-4">
            <p className="text-sm text-blue-800 font-semibold mb-1">Example:</p>
            <p className="text-blue-900">{task.example}</p>
          </div>
        )}

        {task.sentence_starters && task.sentence_starters.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
            <p className="text-sm font-semibold text-amber-800 mb-2">Try starting with one of these:</p>
            <ul className="space-y-1">
              {task.sentence_starters.map((starter, i) => (
                <li key={i} className="text-sm text-amber-900 flex items-start gap-1">
                  <span className="text-amber-600 font-bold mt-0.5">→</span>
                  <span className="italic ml-1">"{starter}"</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={isRecording ? stopRecording : startRecording}
            className={`flex-1 py-3 rounded-lg font-semibold flex items-center justify-center gap-2 ${
              isRecording
                ? 'bg-red-500 text-white'
                : recordings[current]
                ? 'bg-green-500 text-white'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            <Mic className="w-5 h-5" />
            {isRecording ? 'Stop' : recordings[current] ? 'Recorded ✓' : 'Record'}
          </button>

          {recordings[current] && (
            <button
              onClick={playRecording}
              className="px-6 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 flex items-center gap-2"
            >
              <Volume2 className="w-5 h-5" />
              Play
            </button>
          )}
        </div>

        {isAssessing && (
          <p className="mt-3 text-sm text-gray-500 animate-pulse">Assessing pronunciation...</p>
        )}
        {pronunciationResult[current] && !isAssessing && (
          <div className="mt-4 p-3 bg-white border border-green-200 rounded-lg">
            <div className="flex items-center gap-3 mb-2">
              <span className="text-lg font-bold text-gray-900">
                {pronunciationResult[current].overall_score}/100
              </span>
              <span className="text-sm text-gray-700">
                {pronunciationResult[current].feedback}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {pronunciationResult[current].word_scores?.map((w, i) => (
                <span
                  key={i}
                  className={`text-xs px-2 py-1 rounded-full font-medium ${
                    w.correct ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}
                >
                  {w.expected} ({w.score}%)
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <button
        onClick={next}
        disabled={!recordings[current]}
        className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isLast ? 'Complete Speaking Practice' : 'Next Task'}
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}

// WritingExercise Component
export function WritingExercise({ tasks, onComplete, onRequestHelp, storageKey }) {
  const lsKey = storageKey ? `writing_draft_${storageKey}` : null;

  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState(() => {
    if (!lsKey) return {};
    try { return JSON.parse(localStorage.getItem(lsKey) || '{}'); } catch { return {}; }
  });
  // assessmentState: 'idle' | 'loading' | 'passed' | 'failed'
  const [assessmentState, setAssessmentState] = useState('idle');
  const [feedback, setFeedback] = useState('');
  const [feedbackSomali, setFeedbackSomali] = useState('');
  const [score, setScore] = useState(null);
  const abortRef = useRef(null);

  // Persist draft answers to localStorage whenever they change
  useEffect(() => {
    if (!lsKey) return;
    localStorage.setItem(lsKey, JSON.stringify(answers));
  }, [answers, lsKey]);

  const task = tasks[current];
  const isLast = current === tasks.length - 1;
  const currentText = answers[current] || '';

  const submitForReview = async () => {
    setAssessmentState('loading');
    const controller = new AbortController();
    abortRef.current = controller;
    const timeout = setTimeout(() => controller.abort(), 90000);
    try {
      const res = await fetch('/api/writing/assess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          writing_text: currentText,
          prompt_instruction: task.instruction || task.title || '',
          example: task.example || '',
          min_words: 5,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await res.json();
      setScore(data.score);
      setFeedback(data.feedback || '');
      setFeedbackSomali(data.feedback_somali || '');
      setAssessmentState(data.passed ? 'passed' : 'failed');
    } catch {
      clearTimeout(timeout);
      // AI unavailable or timed out — accept the writing and let the student continue
      setScore(null);
      setFeedback('Assessment unavailable. Your writing has been accepted.');
      setFeedbackSomali('');
      setAssessmentState('passed');
    }
  };

  const handleContinue = () => {
    if (isLast) {
      if (lsKey) localStorage.removeItem(lsKey);
      onComplete();
    } else {
      setCurrent(current + 1);
      setAssessmentState('idle');
      setFeedback('');
      setFeedbackSomali('');
      setScore(null);
    }
  };

  const handleTryAgain = () => {
    setAssessmentState('idle');
    setFeedback('');
    setFeedbackSomali('');
    setScore(null);
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Writing Practice</h2>

      <div className="mb-4 text-sm text-gray-600">
        Task {current + 1} of {tasks.length}
      </div>

      <div className="bg-white border-2 border-gray-200 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-gray-900 mb-2">{task.title}</h3>
        <p className="text-gray-700 mb-4">{task.instruction}</p>

        {task.example && (
          <div className="bg-gray-50 rounded-lg p-4 mb-4 border border-gray-200">
            <p className="text-sm text-gray-700 font-semibold mb-1">Example:</p>
            <p className="text-gray-800 italic">{task.example}</p>
          </div>
        )}

        {task.rubric && task.rubric.length > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
            <p className="text-sm font-semibold text-green-800 mb-2">Your response should:</p>
            <ul className="space-y-1">
              {task.rubric.map((criterion, i) => (
                <li key={i} className="text-sm text-green-900 flex items-start gap-2">
                  <span className="text-green-600 font-bold mt-0.5">✓</span>
                  <span>{criterion}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <textarea
          value={currentText}
          onChange={(e) => setAnswers({ ...answers, [current]: e.target.value })}
          placeholder="Write your answer here..."
          disabled={assessmentState === 'loading' || assessmentState === 'passed'}
          className="w-full p-4 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none min-h-[200px] disabled:bg-gray-50 disabled:cursor-not-allowed"
        />
        <p className="text-sm text-gray-500 mt-2">{currentText.length} characters</p>
      </div>

      {/* Passed panel */}
      {assessmentState === 'passed' && (
        <div className="bg-green-50 border-2 border-green-400 rounded-lg p-6 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl font-bold text-green-700">
              {score !== null ? `${score}/100` : '✓'}
            </span>
            <span className="text-green-800 font-semibold text-lg">Great work!</span>
          </div>
          {feedback && <p className="text-green-900 mb-2">{feedback}</p>}
          {feedbackSomali && feedbackSomali !== feedback && (
            <p className="text-green-800 text-sm mb-4 italic">{feedbackSomali}</p>
          )}
          <button
            onClick={handleContinue}
            className="w-full py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
          >
            {isLast ? 'Complete Writing Exercises' : 'Continue'}
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Failed panel */}
      {assessmentState === 'failed' && (
        <div className="bg-orange-50 border-2 border-orange-400 rounded-lg p-6 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl font-bold text-orange-700">{score}/100</span>
            <span className="text-orange-800 font-semibold text-lg">Keep trying!</span>
          </div>
          {feedback && <p className="text-orange-900 mb-2">{feedback}</p>}
          {feedbackSomali && feedbackSomali !== feedback && (
            <p className="text-orange-800 text-sm mb-4 italic">{feedbackSomali}</p>
          )}
          <p className="text-sm text-orange-700 mb-4">Score needed to continue: 60/100</p>
          <button
            onClick={handleTryAgain}
            className="w-full py-3 bg-orange-600 text-white rounded-lg font-semibold hover:bg-orange-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Submit button (idle state) */}
      {assessmentState === 'idle' && (
        <button
          onClick={submitForReview}
          disabled={currentText.length < 20}
          className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          Submit for Review
        </button>
      )}

      {/* Loading state */}
      {assessmentState === 'loading' && (
        <div className="w-full py-3 bg-blue-100 text-blue-700 rounded-lg font-semibold text-center flex items-center justify-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
          Evaluating your writing...
        </div>
      )}
    </div>
  );
}

// GrammarDiscovery Component
export function GrammarDiscovery({ content, onComplete, onRequestHelp }) {
  const [practiceAnswers, setPracticeAnswers] = useState({})

  const renderPracticeSentence = (sentence, item, answered, selectedIdx) => {
    const correctIdx = item.options.indexOf(item.blank)
    const parts = sentence.split('___')
    return (
      <span>
        {parts[0]}
        <span className={`inline-block min-w-[80px] border-b-2 text-center font-bold px-1 ${
          !answered ? 'border-blue-400 text-blue-300' :
          selectedIdx === correctIdx ? 'border-green-500 text-green-700' :
          'border-red-400 text-red-600'
        }`}>
          {answered ? item.options[selectedIdx] : '___'}
        </span>
        {parts[1] || ''}
      </span>
    )
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Grammar Discovery</h2>

      <div className="bg-yellow-50 border-l-4 border-yellow-600 p-4 mb-6">
        <p className="text-yellow-900">
          <strong>Remember:</strong> We don't teach grammar rules. We help you NOTICE patterns.
        </p>
      </div>

      <div className="space-y-6 mb-6">
        {content.sections?.map((section, idx) => (
          <div key={idx} className="bg-white border-2 border-gray-200 rounded-lg p-6">
            <h3 className="font-semibold text-gray-900 mb-3">{section.title}</h3>

            {section.examples && (
              <div className="bg-gray-50 rounded-lg p-4 mb-4">
                {section.examples.map((ex, i) => (
                  <p key={i} className="font-mono text-gray-800 mb-1">{ex}</p>
                ))}
              </div>
            )}

            {section.question && (
              <p className="text-blue-900 font-semibold mb-2">{section.question}</p>
            )}

            {section.explanation && (
              <p className="text-gray-700">{section.explanation}</p>
            )}

            {section.practice && section.practice.length > 0 && (
              <div className="mt-4 border-t border-gray-200 pt-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Quick Practice</p>
                <div className="space-y-4">
                  {section.practice.map((item, itemIdx) => {
                    const key = `${idx}-${itemIdx}`
                    const selectedIdx = practiceAnswers[key]
                    const answered = selectedIdx !== undefined
                    const correctIdx = item.options.indexOf(item.blank)
                    return (
                      <div key={itemIdx} className="bg-gray-50 rounded-lg p-3">
                        <p className="text-gray-800 text-sm mb-2">
                          {renderPracticeSentence(item.sentence, item, answered, selectedIdx)}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {item.options.map((opt, optIdx) => (
                            <button
                              key={optIdx}
                              disabled={answered}
                              onClick={() => setPracticeAnswers(prev => ({ ...prev, [key]: optIdx }))}
                              className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                                answered
                                  ? optIdx === correctIdx
                                    ? 'bg-green-100 border-green-400 text-green-800'
                                    : optIdx === selectedIdx
                                    ? 'bg-red-100 border-red-400 text-red-700'
                                    : 'bg-gray-100 border-gray-300 text-gray-400'
                                  : 'bg-white border-gray-300 text-gray-700 hover:border-blue-400 hover:bg-blue-50'
                              }`}
                            >
                              {opt}{answered && optIdx === correctIdx ? ' ✓' : ''}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        onClick={onComplete}
        className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
      >
        Continue to Quiz
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  );
}