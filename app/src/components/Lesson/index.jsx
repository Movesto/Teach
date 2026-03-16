import { ChevronRight } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { GRAMMAR_KEYWORDS } from '../../pages/GrammarGuide';
import { Volume2, Mic, Check, X } from 'lucide-react';
import { releaseAudioSession } from '../../utils/audio';

// StorySection Component
export function StorySection({ story, onComplete, onRequestHelp }) {
  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">The Situation</h2>

      {story.context && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-600 p-4 mb-6">
          <p className="text-blue-900 dark:text-blue-200 font-semibold mb-1">Context:</p>
          <p className="text-blue-800 dark:text-blue-300">{story.context}</p>
        </div>
      )}

      <div className="prose max-w-none mb-6">
        {story.dialogue?.map((line, idx) => (
          <div key={idx} className="mb-6">
            <p className="font-bold text-gray-900 dark:text-white mb-1">{line.speaker}:</p>
            <p className="text-gray-800 dark:text-gray-200 text-lg ml-4 leading-relaxed">{line.text}</p>
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
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef(null);

  const exercise = exercises[current];
  const isLast = current === exercises.length - 1;

  const toggleAudio = () => {
    if (isPlaying) {
      audioRef.current?.pause();
      audioRef.current = null;
      setIsPlaying(false);
      return;
    }
    const audio = new Audio(exercise.audio);
    audioRef.current = audio;
    audio.onended = () => { setIsPlaying(false); audioRef.current = null; };
    audio.onerror = () => { setIsPlaying(false); audioRef.current = null; };
    audio.play();
    setIsPlaying(true);
  };

  const handleAnswer = (idx) => {
    setAnswers({ ...answers, [current]: idx });
    setShowFeedback(true);
  };

  const next = () => {
    audioRef.current?.pause();
    audioRef.current = null;
    setIsPlaying(false);
    setShowFeedback(false);
    if (isLast) {
      onComplete();
    } else {
      setCurrent(current + 1);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Listening Practice</h2>

      <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        Exercise {current + 1} of {exercises.length}
      </div>

      <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
        <p className="text-gray-900 dark:text-white font-semibold mb-4">{exercise.question}</p>

        <button
          onClick={toggleAudio}
          className={`w-full py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2 mb-6 ${
            isPlaying ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
          }`}
        >
          <Volume2 className="w-5 h-5" />
          {isPlaying ? 'Stop Audio' : 'Play Audio'}
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
                      ? 'bg-green-100 dark:bg-green-900/30 border-2 border-green-500 text-green-900 dark:text-green-200'
                      : isSelected
                      ? 'bg-red-100 dark:bg-red-900/30 border-2 border-red-500 text-red-900 dark:text-red-200'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                    : isSelected
                    ? 'bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-500 text-blue-900 dark:text-blue-200'
                    : 'bg-gray-50 dark:bg-gray-700 border-2 border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 text-gray-900 dark:text-white'
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
          <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-600 rounded">
            <p className="text-sm text-blue-900 dark:text-blue-300">{exercise.explanation}</p>
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
  const [isPlayingBack, setIsPlayingBack] = useState(false);
  const [isSpeakingDemo, setIsSpeakingDemo] = useState(false);
  const [assessmentResult, setAssessmentResult] = useState({});
  const [isAssessing, setIsAssessing] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const playbackAudioRef = useRef(null);
  const recognitionRef = useRef(null);
  const transcriptRef = useRef('');

  const task = tasks[current];
  const isLast = current === tasks.length - 1;
  const exampleText = task.example || '';

  // ── Demo: speak the example using browser TTS ──
  const speakDemo = () => {
    if (!window.speechSynthesis) return;
    if (isSpeakingDemo) {
      window.speechSynthesis.cancel();
      setIsSpeakingDemo(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(exampleText);
    utterance.lang = 'en-US';
    utterance.rate = 0.85;
    utterance.onend = () => setIsSpeakingDemo(false);
    utterance.onerror = () => setIsSpeakingDemo(false);
    setIsSpeakingDemo(true);
    window.speechSynthesis.speak(utterance);
  };

  const startRecording = async () => {
    window.speechSynthesis?.cancel();
    setIsSpeakingDemo(false);
    playbackAudioRef.current?.pause();
    playbackAudioRef.current = null;
    setIsPlayingBack(false);
    const taskIndex = current;
    const expectedText = task.example || task.instruction || '';
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      transcriptRef.current = '';

      // Start speech recognition alongside recording
      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SR) {
        const recognition = new SR();
        recognition.lang = 'en-US';
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.onresult = (e) => {
          for (let i = e.resultIndex; i < e.results.length; i++) {
            if (e.results[i].isFinal) transcriptRef.current += ' ' + e.results[i][0].transcript;
          }
        };
        recognition.onerror = () => {};
        recognitionRef.current = recognition;
        recognition.start();
      }

      mediaRecorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mediaRecorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setRecordings(prev => ({ ...prev, [taskIndex]: url }));
        stream.getTracks().forEach(t => t.stop());
        releaseAudioSession();

        const transcript = transcriptRef.current.trim();
        if (expectedText) {
          setIsAssessing(true);
          fetch('/api/speaking/assess', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ transcript, expected: expectedText }),
          })
            .then(r => r.ok ? r.json() : null)
            .then(result => {
              if (result) setAssessmentResult(prev => ({ ...prev, [taskIndex]: result }));
              setIsAssessing(false);
            })
            .catch(() => setIsAssessing(false));
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch {
      alert('Microphone access denied. Please enable microphone permissions.');
    }
  };

  const stopRecording = () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  };

  const togglePlayback = () => {
    if (isPlayingBack) {
      playbackAudioRef.current?.pause();
      playbackAudioRef.current = null;
      setIsPlayingBack(false);
      return;
    }
    if (!recordings[current]) return;
    const audio = new Audio(recordings[current]);
    playbackAudioRef.current = audio;
    audio.onended = () => { setIsPlayingBack(false); playbackAudioRef.current = null; };
    audio.play();
    setIsPlayingBack(true);
  };

  const next = () => {
    window.speechSynthesis?.cancel();
    playbackAudioRef.current?.pause();
    playbackAudioRef.current = null;
    setIsPlayingBack(false);
    setIsSpeakingDemo(false);
    if (isLast) {
      onComplete();
    } else {
      setCurrent(current + 1);
    }
  };

  const result = assessmentResult[current];
  const scoreColor = result
    ? result.score >= 80 ? 'text-green-600 dark:text-green-400'
    : result.score >= 50 ? 'text-amber-500 dark:text-amber-400'
    : 'text-red-500 dark:text-red-400'
    : '';

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Speaking Practice</h2>

      <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        Task {current + 1} of {tasks.length}
      </div>

      <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{task.title}</h3>
        <p className="text-gray-700 dark:text-gray-300 mb-4">{task.instruction}</p>

        {exampleText && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg p-4 mb-4">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm text-blue-800 dark:text-blue-300 font-semibold">Example — listen then repeat:</p>
              <button
                onClick={speakDemo}
                disabled={isRecording}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-colors ${
                  isSpeakingDemo
                    ? 'bg-blue-600 text-white'
                    : 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-800'
                }`}
              >
                <Volume2 className="w-3.5 h-3.5" />
                {isSpeakingDemo ? 'Stop' : 'Hear it'}
              </button>
            </div>
            <p className="text-blue-900 dark:text-blue-200 text-lg font-medium">{exampleText}</p>
          </div>
        )}

        {task.sentence_starters?.length > 0 && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-4 mb-4">
            <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-2">Try starting with one of these:</p>
            <ul className="space-y-1">
              {task.sentence_starters.map((starter, i) => (
                <li key={i} className="text-sm text-amber-900 dark:text-amber-200 flex items-start gap-1">
                  <span className="text-amber-600 dark:text-amber-400 font-bold mt-0.5">→</span>
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
                ? 'bg-red-500 hover:bg-red-600 text-white'
                : recordings[current]
                ? 'bg-green-500 hover:bg-green-600 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            <Mic className="w-5 h-5" />
            {isRecording ? '⏹ Stop Recording' : recordings[current] ? '✓ Re-record' : '🎤 Record'}
          </button>

          {recordings[current] && (
            <button
              onClick={togglePlayback}
              className={`px-5 py-3 rounded-lg font-semibold flex items-center gap-2 ${
                isPlayingBack ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-gray-600 hover:bg-gray-700 text-white'
              }`}
            >
              <Volume2 className="w-5 h-5" />
              {isPlayingBack ? 'Stop' : 'Play'}
            </button>
          )}
        </div>

        {isAssessing && (
          <div className="mt-4 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
            Analysing your speech...
          </div>
        )}

        {result && !isAssessing && (
          <div className="mt-4 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4">
            <div className="flex items-center gap-3 mb-3">
              <span className={`text-2xl font-bold ${scoreColor}`}>{result.score}/100</span>
              {result.feedback && <span className="text-sm text-gray-700 dark:text-gray-300 flex-1">{result.feedback}</span>}
            </div>
            {result.transcript && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 italic">
                Heard: "{result.transcript}"
              </p>
            )}
            {result.word_scores?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {result.word_scores.map((w, i) => (
                  <span key={i} className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                    w.correct
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                      : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                  }`}>
                    {w.correct ? '✓' : '✗'} {w.word}
                  </span>
                ))}
              </div>
            )}
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
  const [assessmentState, setAssessmentState] = useState('idle');
  const [feedback, setFeedback] = useState('');
  const [feedbackSomali, setFeedbackSomali] = useState('');
  const [score, setScore] = useState(null);
  const abortRef = useRef(null);

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
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Writing Practice</h2>

      <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
        Task {current + 1} of {tasks.length}
      </div>

      <div className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-6 mb-6">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">{task.title}</h3>
        <p className="text-gray-700 dark:text-gray-300 mb-4">{task.instruction}</p>

        {task.example && (
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4 border border-gray-200 dark:border-gray-600">
            <p className="text-sm text-gray-700 dark:text-gray-300 font-semibold mb-1">Example:</p>
            <p className="text-gray-800 dark:text-gray-200 italic">{task.example}</p>
          </div>
        )}

        {task.rubric && task.rubric.length > 0 && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-lg p-4 mb-4">
            <p className="text-sm font-semibold text-green-800 dark:text-green-300 mb-2">Your response should:</p>
            <ul className="space-y-1">
              {task.rubric.map((criterion, i) => (
                <li key={i} className="text-sm text-green-900 dark:text-green-200 flex items-start gap-2">
                  <span className="text-green-600 dark:text-green-400 font-bold mt-0.5">✓</span>
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
          className="w-full p-4 border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:border-blue-500 focus:outline-none min-h-[200px] disabled:bg-gray-50 disabled:dark:bg-gray-700 disabled:cursor-not-allowed bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
        />
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">{currentText.length} characters</p>
      </div>

      {/* Passed panel */}
      {assessmentState === 'passed' && (
        <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-400 dark:border-green-600 rounded-lg p-6 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl font-bold text-green-700 dark:text-green-400">
              {score !== null ? `${score}/100` : '✓'}
            </span>
            <span className="text-green-800 dark:text-green-300 font-semibold text-lg">Great work!</span>
          </div>
          {feedback && <p className="text-green-900 dark:text-green-200 mb-2">{feedback}</p>}
          {feedbackSomali && feedbackSomali !== feedback && (
            <p className="text-green-800 dark:text-green-300 text-sm mb-4 italic">{feedbackSomali}</p>
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
        <div className="bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-400 dark:border-orange-600 rounded-lg p-6 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <span className="text-3xl font-bold text-orange-700 dark:text-orange-400">{score}/100</span>
            <span className="text-orange-800 dark:text-orange-300 font-semibold text-lg">Keep trying!</span>
          </div>
          {feedback && <p className="text-orange-900 dark:text-orange-200 mb-2">{feedback}</p>}
          {feedbackSomali && feedbackSomali !== feedback && (
            <p className="text-orange-800 dark:text-orange-300 text-sm mb-4 italic">{feedbackSomali}</p>
          )}
          <p className="text-sm text-orange-700 dark:text-orange-400 mb-4">Score needed to continue: 60/100</p>
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
        <div className="w-full py-3 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg font-semibold text-center flex items-center justify-center gap-3">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600 dark:border-blue-400"></div>
          Evaluating your writing...
        </div>
      )}
    </div>
  );
}

// Detect relevant grammar concept IDs from the content text
function detectConcepts(content) {
  const allText = (content.sections || [])
    .map(s => `${s.title || ''} ${s.explanation || ''} ${s.question || ''}`)
    .join(' ')
    .toLowerCase();

  return GRAMMAR_KEYWORDS
    .filter(({ keywords }) => keywords.some(kw => allText.includes(kw.toLowerCase())))
    .map(({ id }) => id);
}

// GrammarDiscovery Component
export function GrammarDiscovery({ content, onComplete, onRequestHelp, unitId }) {
  const [practiceAnswers, setPracticeAnswers] = useState({});
  const conceptIds = (unitId == null || unitId <= 8) ? detectConcepts(content) : [];

  const renderPracticeSentence = (sentence, item, answered, selectedIdx) => {
    const correctIdx = item.options.indexOf(item.blank)
    const parts = sentence.split('___')
    return (
      <span>
        {parts[0]}
        <span className={`inline-block min-w-[80px] border-b-2 text-center font-bold px-1 ${
          !answered ? 'border-blue-400 text-blue-300' :
          selectedIdx === correctIdx ? 'border-green-500 text-green-700 dark:text-green-400' :
          'border-red-400 text-red-600 dark:text-red-400'
        }`}>
          {answered ? item.options[selectedIdx] : '___'}
        </span>
        {parts[1] || ''}
      </span>
    )
  }

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Grammar Discovery</h2>

      <div className="bg-yellow-50 dark:bg-yellow-900/20 border-l-4 border-yellow-600 p-4 mb-4">
        <p className="text-yellow-900 dark:text-yellow-200">
          <strong>Remember:</strong> We don't teach grammar rules. We help you NOTICE patterns.
        </p>
      </div>

      {conceptIds.length > 0 && (
        <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-xl px-4 py-3 mb-6 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide mr-1">
            📖 Learn these concepts:
          </span>
          {conceptIds.map(id => {
            const label = id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            return (
              <Link
                key={id}
                to={`/grammar#${id}`}
                className="px-2.5 py-1 bg-white dark:bg-gray-800 border border-indigo-300 dark:border-indigo-600 text-indigo-700 dark:text-indigo-400 rounded-full text-xs font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/30 transition-colors"
              >
                {label} →
              </Link>
            );
          })}
        </div>
      )}

      <div className="space-y-6 mb-6">
        {content.sections?.map((section, idx) => (
          <div key={idx} className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">{section.title}</h3>

            {section.examples && (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-4">
                {section.examples.map((ex, i) => (
                  <p key={i} className="font-mono text-gray-800 dark:text-gray-200 mb-1">{ex}</p>
                ))}
              </div>
            )}

            {section.question && (
              <p className="text-blue-900 dark:text-blue-300 font-semibold mb-2">{section.question}</p>
            )}

            {section.explanation && (
              <p className="text-gray-700 dark:text-gray-300">{section.explanation}</p>
            )}

            {section.practice && section.practice.length > 0 && (
              <div className="mt-4 border-t border-gray-200 dark:border-gray-600 pt-4">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">Quick Practice</p>
                <div className="space-y-4">
                  {section.practice.map((item, itemIdx) => {
                    const key = `${idx}-${itemIdx}`
                    const selectedIdx = practiceAnswers[key]
                    const answered = selectedIdx !== undefined
                    const correctIdx = item.options.indexOf(item.blank)
                    return (
                      <div key={itemIdx} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-3">
                        <p className="text-gray-800 dark:text-gray-200 text-sm mb-2">
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
                                    ? 'bg-green-100 dark:bg-green-900/30 border-green-400 dark:border-green-600 text-green-800 dark:text-green-300'
                                    : optIdx === selectedIdx
                                    ? 'bg-red-100 dark:bg-red-900/30 border-red-400 dark:border-red-600 text-red-700 dark:text-red-400'
                                    : 'bg-gray-100 dark:bg-gray-600 border-gray-300 dark:border-gray-500 text-gray-400'
                                  : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-blue-400 hover:bg-blue-50 dark:hover:border-blue-500 dark:hover:bg-blue-900/20'
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
