import { useState, useRef, useEffect } from 'react';
import { Volume2, Mic, ChevronRight, Check, X } from 'lucide-react';

export function PatternDrill({ drills, onComplete, onRequestHelp }) {
  const [currentDrill, setCurrentDrill] = useState(0);
  const [currentPrompt, setCurrentPrompt] = useState(0);
  const [promptInput, setPromptInput] = useState('');
  const [promptFeedback, setPromptFeedback] = useState(null); // null | 'correct' | 'wrong'
  const [completedPrompts, setCompletedPrompts] = useState({}); // { drillIdx: count }
  const [showYourTurn, setShowYourTurn] = useState(false);
  const [recordings, setRecordings] = useState({});
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const inputRef = useRef(null);
  const [pronunciationResult, setPronunciationResult] = useState({})
  const [isAssessing, setIsAssessing] = useState(false)

  // Clean up blob URLs on unmount to prevent memory leaks
  useEffect(() => {
    return () => {
      Object.values(recordings).forEach(url => URL.revokeObjectURL(url));
    };
  }, [recordings]);

  const drill = drills[currentDrill];
  const isLastDrill = currentDrill === drills.length - 1;
  const hasPrompts = drill.prompts && drill.prompts.length > 0;

  const startRecording = async () => {
    const drillIndex = currentDrill;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        setRecordings({
          ...recordings,
          [drillIndex]: audioUrl
        });
        stream.getTracks().forEach(track => track.stop());

        const formData = new FormData()
        formData.append('audio', audioBlob, 'recording.webm')
        formData.append('language', 'english')
        formData.append('expected_text', drills[drillIndex].your_turn)
        setIsAssessing(true)
        fetch('/api/pronunciation/assess', { method: 'POST', body: formData })
          .then(r => r.json())
          .then(result => {
            setPronunciationResult(prev => ({ ...prev, [drillIndex]: result }))
            setIsAssessing(false)
          })
          .catch(() => setIsAssessing(false))
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Error accessing microphone:', err);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const playRecording = () => {
    if (recordings[currentDrill]) {
      const audio = new Audio(recordings[currentDrill]);
      audio.play();
    }
  };

  const normalizePunctuation = (s) =>
    s.trim().toLowerCase().replace(/[.,!?;:'"()\-]/g, '').replace(/\s+/g, ' ').trim();

  const handlePromptSubmit = () => {
    if (!promptInput.trim()) return;
    const correct = normalizePunctuation(promptInput) === normalizePunctuation(drill.prompts[currentPrompt].answer);
    setPromptFeedback(correct ? 'correct' : 'wrong');
  };

  const handlePromptNext = () => {
    const nextPrompt = currentPrompt + 1;
    const done = (completedPrompts[currentDrill] || 0) + 1;
    setCompletedPrompts({ ...completedPrompts, [currentDrill]: done });
    setPromptInput('');
    setPromptFeedback(null);

    if (nextPrompt >= drill.prompts.length) {
      // All prompts done, show "Your Turn"
      setShowYourTurn(true);
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
      setShowYourTurn(false);
    }
  };

  // Render the sentence with the blank highlighted
  const renderSentence = (sentence, answer, showAnswer) => {
    const parts = sentence.split('___');
    return (
      <span className="text-xl">
        {parts[0]}
        <span className={`inline-block min-w-[80px] border-b-2 text-center font-bold ${
          showAnswer ? 'border-green-500 text-green-700' : 'border-blue-500 text-blue-700'
        }`}>
          {showAnswer ? answer : '___'}
        </span>
        {parts[1]}
      </span>
    );
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 mb-4">Pattern Drills</h2>

      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-gray-700">
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
                    : 'bg-gray-300'
                }`}
              ></div>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-4">{drill.title}</h3>
        <p className="text-blue-800 mb-4">{drill.instruction}</p>

        {/* Interactive prompts mode */}
        {hasPrompts && !showYourTurn && (
          <div>
            {/* Prompt progress */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-sm text-gray-600">
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
                        : 'bg-gray-300'
                    }`}
                  ></div>
                ))}
              </div>
            </div>

            {/* Sentence with blank */}
            <div className="bg-white rounded-lg p-6 border border-blue-200 mb-4 text-center">
              {renderSentence(
                drill.prompts[currentPrompt].sentence,
                drill.prompts[currentPrompt].answer,
                promptFeedback === 'correct'
              )}
            </div>

            {/* Input and submit */}
            {promptFeedback === null && (
              <div className="flex gap-3">
                <input
                  ref={inputRef}
                  type="text"
                  value={promptInput}
                  onChange={(e) => setPromptInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type the missing word..."
                  autoFocus
                  className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none text-lg"
                />
                <button
                  onClick={handlePromptSubmit}
                  disabled={!promptInput.trim()}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Check
                </button>
              </div>
            )}

            {/* Feedback */}
            {promptFeedback === 'correct' && (
              <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Check className="w-6 h-6 text-green-600" />
                  <span className="font-bold text-green-800 text-lg">Correct!</span>
                </div>
                <button
                  onClick={handlePromptNext}
                  autoFocus
                  className="mt-2 px-6 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors"
                >
                  {currentPrompt + 1 >= drill.prompts.length ? 'Continue to Your Turn' : 'Next'}
                </button>
              </div>
            )}

            {promptFeedback === 'wrong' && (
              <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <X className="w-6 h-6 text-red-600" />
                  <span className="font-bold text-red-800 text-lg">Not quite</span>
                </div>
                <p className="text-red-700">
                  The correct answer is: <strong>{drill.prompts[currentPrompt].answer}</strong>
                </p>
                <button
                  onClick={handlePromptNext}
                  autoFocus
                  className="mt-2 px-6 py-2 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors"
                >
                  {currentPrompt + 1 >= drill.prompts.length ? 'Continue to Your Turn' : 'Next'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Passive mode fallback (no prompts) — show examples list */}
        {!hasPrompts && !showYourTurn && (
          <div className="space-y-3 mb-6">
            {drill.examples.map((example, idx) => (
              <div key={idx} className="bg-white rounded-lg p-4 border border-blue-200">
                <p className="text-gray-800 font-medium">{example}</p>
              </div>
            ))}
          </div>
        )}

        {/* Your Turn section — shown after prompts complete, or immediately for passive drills */}
        {(showYourTurn || !hasPrompts) && (
          <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
            <p className="font-semibold text-green-900 mb-3">Your Turn: {drill.your_turn}</p>
            <p className="text-sm text-green-800 mb-4">
              Record yourself saying this{drill.repetitions > 1 ? ` ${drill.repetitions} times` : ''}.
            </p>

            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  if (isRecording) {
                    stopRecording();
                  } else {
                    startRecording();
                  }
                }}
                className={`flex-1 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 ${
                  isRecording
                    ? 'bg-red-500 text-white hover:bg-red-600'
                    : recordings[currentDrill]
                    ? 'bg-green-500 text-white hover:bg-green-600'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                <Mic className="w-5 h-5" />
                {isRecording ? 'Stop Recording' : recordings[currentDrill] ? 'Recorded' : 'Start Recording'}
              </button>

              {recordings[currentDrill] && (
                <button
                  onClick={playRecording}
                  className="px-6 py-3 bg-gray-600 text-white rounded-lg font-semibold hover:bg-gray-700 transition-colors flex items-center gap-2"
                >
                  <Volume2 className="w-5 h-5" />
                  Playback
                </button>
              )}
            </div>

            {isAssessing && (
              <p className="mt-3 text-sm text-gray-500 animate-pulse">Assessing pronunciation...</p>
            )}
            {pronunciationResult[currentDrill] && !isAssessing && (
              <div className="mt-4 p-3 bg-white border border-green-200 rounded-lg">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-lg font-bold text-gray-900">
                    {pronunciationResult[currentDrill].overall_score}/100
                  </span>
                  <span className="text-sm text-gray-700">
                    {pronunciationResult[currentDrill].feedback}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {pronunciationResult[currentDrill].word_scores?.map((w, i) => (
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
              setShowYourTurn(false);
            }}
            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
          >
            Previous Drill
          </button>
        )}
        <button
          onClick={nextDrill}
          disabled={hasPrompts ? !showYourTurn : !recordings[currentDrill]}
          className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLastDrill ? 'Complete Drills' : 'Next Drill'}
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <button
        onClick={() => onRequestHelp({ type: 'drill', content: drill })}
        className="mt-4 text-blue-600 hover:underline text-sm"
      >
        Need help understanding this pattern?
      </button>
    </div>
  );
}
