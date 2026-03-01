import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Square, Play, ChevronLeft, ChevronRight, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const CEFR_COLORS = {
  A1: 'bg-gray-100 text-gray-800 border-gray-300',
  A2: 'bg-blue-100 text-blue-800 border-blue-300',
  B1: 'bg-green-100 text-green-800 border-green-300',
  B2: 'bg-teal-100 text-teal-800 border-teal-300',
  C1: 'bg-indigo-100 text-indigo-800 border-indigo-300',
};
const CEFR_BAR = {
  A1: 'bg-gray-400', A2: 'bg-blue-500', B1: 'bg-green-500', B2: 'bg-teal-500', C1: 'bg-indigo-600',
};
const LEVEL_SOMALI = {
  beginner: 'Bilow', elementary: 'Aasaasi', intermediate: 'Dhexdhexaad',
  'upper-intermediate': 'Sare-Dhexe', advanced: 'Horumarsan',
};

function flattenSections(sections) {
  const cards = [];
  sections.forEach(section => {
    if (section.id === 'reading') {
      section.passages?.forEach(p =>
        p.questions?.forEach(q =>
          cards.push({ ...q, _sectionName: 'Reading', _passageText: p.text })
        )
      );
    } else if (section.id === 'speaking') {
      section.prompts?.forEach(p =>
        cards.push({ ...p, _type: 'speaking', _sectionName: 'Speaking' })
      );
    } else {
      section.questions?.forEach(q =>
        cards.push({ ...q, _sectionName: section.title || section.id, _audioUrl: q.audio_url || q.audio })
      );
    }
  });
  return cards;
}

export default function PlacementTest() {
  const navigate = useNavigate();
  const { token } = useAuth();

  const [testData, setTestData] = useState(null);
  const [allCards, setAllCards] = useState([]);
  const [screen, setScreen] = useState('intro'); // 'intro' | 'test' | 'result'
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlobs, setAudioBlobs] = useState({});
  const [result, setResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [passageOpen, setPassageOpen] = useState(false);
  const [startTime] = useState(Date.now());

  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);

  useEffect(() => {
    fetch('/api/placement/test')
      .then(r => r.json())
      .then(data => {
        setTestData(data);
        setAllCards(flattenSections(data.sections || []));
      })
      .catch(err => console.error('Error loading placement test:', err));
  }, []);

  if (!testData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading placement test...</p>
        </div>
      </div>
    );
  }

  const card = allCards[idx];
  const isLast = idx === allCards.length - 1;
  const totalCards = allCards.length;

  // ── Recording helpers ──
  const startRecording = async (id) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];
      mediaRecorder.current.ondataavailable = e => audioChunks.current.push(e.data);
      mediaRecorder.current.onstop = () => {
        const blob = new Blob(audioChunks.current, { type: 'audio/wav' });
        setAudioBlobs(prev => ({ ...prev, [id]: blob }));
        setAnswers(prev => ({ ...prev, [id]: { question_id: id, audio_url: `audio_${id}` } }));
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorder.current.start();
      setIsRecording(true);
    } catch {
      alert('Please allow microphone access / Ogolow isticmaalka makarafoonka');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      setIsRecording(false);
    }
  };

  const playRecording = (id) => {
    if (audioBlobs[id]) new Audio(URL.createObjectURL(audioBlobs[id])).play();
  };

  const handleAnswer = (questionId, optionIndex) => {
    setAnswers(prev => ({ ...prev, [questionId]: { question_id: questionId, selected_option: optionIndex } }));
  };

  const handleNext = () => {
    if (!isLast) { setIdx(i => i + 1); setPassageOpen(false); }
  };

  const handleBack = () => {
    if (idx > 0) { setIdx(i => i - 1); setPassageOpen(false); }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    const timeTaken = Math.round((Date.now() - startTime) / 60000);
    try {
      const res = await fetch('/api/placement/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: Object.values(answers), time_taken_minutes: timeTaken }),
      });
      const data = await res.json();
      setResult(data);
      setScreen('result');
    } catch {
      alert('Error submitting test. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartLearning = async () => {
    if (!result) return;
    setIsSaving(true);
    try {
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      await fetch('/api/placement/save', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          score: result.total_score,
          percentage: result.percentage,
          level: result.level,
          cefr: result.cefr,
          recommended_unit: result.recommended_unit,
          breakdown: result.breakdown,
        }),
      });
    } catch (e) {
      console.error('Could not save placement result:', e);
    } finally {
      setIsSaving(false);
      navigate('/home');
    }
  };

  // ── INTRO SCREEN ──
  if (screen === 'intro') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <div className="bg-white rounded-2xl shadow-lg p-10">
          <div className="text-5xl mb-4">🎯</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">English Placement Test</h1>
          <p className="text-indigo-600 font-semibold text-lg mb-6">Imtixaanka Heerka Ingiriisiga</p>
          <div className="text-left space-y-3 mb-8">
            <p className="text-gray-700">
              This short test helps us find your exact English level so you can start at the right place.
            </p>
            <p className="text-gray-500 text-sm">
              Imtixaankan gaaban wuxuu naga caawiyaa inaan ogaano heerkaaga Ingiriisiga si aad uga bilaabato meeshii saxda ahayd.
            </p>
            <div className="bg-indigo-50 rounded-lg p-4 mt-4 text-sm text-indigo-800">
              <p className="font-semibold mb-1">What to expect / Maxaad u diyaargaroowdaa:</p>
              <ul className="space-y-1 text-indigo-700">
                <li>• {totalCards} questions · Grammar, Listening, Reading, Speaking</li>
                <li>• ~15 minutes · Answer as many as you can</li>
                <li>• No right or wrong — just find your level</li>
              </ul>
            </div>
          </div>
          <button
            onClick={() => setScreen('test')}
            className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg hover:bg-indigo-700 transition-colors"
          >
            Start Test / Bilow Imtixaanka →
          </button>
        </div>
      </div>
    );
  }

  // ── RESULT SCREEN ──
  if (screen === 'result' && result) {
    const cefr = result.cefr?.toUpperCase() || 'A1';
    const colorClass = CEFR_COLORS[cefr] || CEFR_COLORS.A1;
    const barClass = CEFR_BAR[cefr] || CEFR_BAR.A1;
    const levelSomali = LEVEL_SOMALI[result.level] || result.level;

    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-6">Test Complete! / Imtixaanka waa la dhamaystiray!</h1>

          {/* CEFR badge */}
          <div className={`inline-block border-2 rounded-2xl px-8 py-5 mb-6 ${colorClass}`}>
            <div className="text-5xl font-extrabold mb-1">{cefr}</div>
            <div className="text-lg font-semibold">{result.percentage}%</div>
          </div>

          <div className="mb-2">
            <p className="text-xl font-bold text-gray-900">Your level: {result.level?.charAt(0).toUpperCase() + result.level?.slice(1)}</p>
            <p className="text-indigo-600 font-medium">Heerkaaga: {levelSomali}</p>
          </div>

          {result.message && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 my-5 text-left">
              <p className="text-green-800 text-sm">{result.message}</p>
            </div>
          )}

          {/* Score breakdown */}
          <div className="mt-6 mb-8">
            <h3 className="font-bold text-gray-900 mb-4 text-left">Score Breakdown / Faahfaahinta Dhibcaha</h3>
            <div className="space-y-3">
              {Object.entries(result.breakdown || {}).map(([section, data]) => (
                <div key={section}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="font-medium text-gray-700 capitalize">{section}</span>
                    <span className="text-gray-500">{data.score}/{data.max}</span>
                  </div>
                  <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${barClass}`}
                      style={{ width: `${data.max > 0 ? (data.score / data.max) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-purple-50 rounded-xl p-4 mb-6 text-left">
            <p className="text-sm font-semibold text-purple-800 mb-1">📚 Recommended Starting Point</p>
            <p className="text-purple-700">
              <span className="font-semibold">Unit {result.recommended_unit}:</span> {result.unit_name}
            </p>
          </div>

          <button
            onClick={handleStartLearning}
            disabled={isSaving}
            className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold text-lg hover:bg-indigo-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                Saving...
              </>
            ) : (
              'Bilow Barashada → / Start Learning'
            )}
          </button>
        </div>
      </div>
    );
  }

  // ── TEST SCREEN ──
  const progress = ((idx + 1) / totalCards) * 100;
  const isSpeaking = card?._type === 'speaking';
  const hasAnswer = isSpeaking
    ? !!audioBlobs[card?.id]
    : answers[card?.id]?.selected_option !== undefined;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Progress */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span className="font-medium">{card?._sectionName}</span>
          <span>{idx + 1} / {totalCards}</span>
        </div>
        <div className="h-2.5 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        {card?._sectionName && (
          <span className="inline-block mt-2 px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs rounded-full font-medium">
            {card._sectionName}
          </span>
        )}
      </div>

      <div className="bg-white rounded-2xl shadow-md p-6">
        {/* Passage (collapsible) */}
        {card?._passageText && (
          <div className="mb-4">
            <button
              onClick={() => setPassageOpen(o => !o)}
              className="flex items-center gap-2 text-sm text-indigo-600 font-medium hover:text-indigo-800 mb-2"
            >
              📖 {passageOpen ? 'Hide Passage' : 'Show Reading Passage'}
            </button>
            {passageOpen && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {card._passageText}
              </div>
            )}
          </div>
        )}

        {/* Speaking card */}
        {isSpeaking && (
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Speaking / Hadal</p>
            <h2 className="text-xl font-bold text-gray-900 mb-2">{card.prompt}</h2>
            {card.example && (
              <p className="text-sm text-gray-500 mb-1"><strong>Example:</strong> {card.example}</p>
            )}
            {card.min_seconds && (
              <p className="text-xs text-gray-400 mb-4">
                Record {card.min_seconds}–{card.max_seconds} seconds
              </p>
            )}
            <div className="flex gap-3 flex-wrap mt-2">
              {!audioBlobs[card.id] ? (
                !isRecording ? (
                  <button
                    onClick={() => startRecording(card.id)}
                    className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 font-medium"
                  >
                    <Mic size={18} /> Start Recording
                  </button>
                ) : (
                  <button
                    onClick={stopRecording}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 font-medium"
                  >
                    <Square size={18} /> Stop
                  </button>
                )
              ) : (
                <>
                  <button
                    onClick={() => playRecording(card.id)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-medium"
                  >
                    <Play size={18} /> Play Back
                  </button>
                  <button
                    onClick={() => {
                      setAudioBlobs(prev => { const n = { ...prev }; delete n[card.id]; return n; });
                      setAnswers(prev => { const n = { ...prev }; delete n[card.id]; return n; });
                    }}
                    className="px-4 py-2 bg-gray-400 text-white rounded-lg hover:bg-gray-500 font-medium"
                  >
                    Re-record
                  </button>
                  <CheckCircle className="text-green-500 self-center" size={22} />
                </>
              )}
            </div>
          </div>
        )}

        {/* Audio question */}
        {!isSpeaking && card?._audioUrl && (
          <div className="mb-4">
            <audio controls src={card._audioUrl} className="w-full rounded-lg" />
          </div>
        )}

        {/* Multiple choice */}
        {!isSpeaking && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-5">{card?.question}</h2>
            <div className="space-y-3">
              {card?.options?.map((option, optIdx) => {
                const selected = answers[card.id]?.selected_option === optIdx;
                return (
                  <label
                    key={optIdx}
                    className={`flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition-all ${
                      selected
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name={card.id}
                      checked={selected}
                      onChange={() => handleAnswer(card.id, optIdx)}
                      className="w-4 h-4 accent-indigo-600"
                    />
                    <span className="text-gray-800">{option}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <button
          onClick={handleBack}
          disabled={idx === 0}
          className="flex items-center gap-2 px-5 py-2.5 border-2 border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
        >
          <ChevronLeft size={18} /> Back
        </button>

        {isLast ? (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="flex items-center gap-2 px-6 py-2.5 bg-green-600 text-white rounded-xl hover:bg-green-700 font-semibold disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Submitting...
              </>
            ) : 'Submit Test ✓'}
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-semibold"
          >
            Next <ChevronRight size={18} />
          </button>
        )}
      </div>
    </div>
  );
}
