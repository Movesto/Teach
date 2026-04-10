import { useState, useEffect, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CheckCircle, XCircle, ArrowLeft, ArrowRight, Trophy, RotateCcw, Eye, Pencil } from 'lucide-react';

// ─── Scoring ─────────────────────────────────────────────────────────────────

function scoreQuestion(q, answer) {
  switch (q.type) {
    case 'multiple-choice':
      return answer === q.correct;
    case 'true-false':
      return answer === q.correct;
    case 'fill-in-blank':
      return (q.accepted_answers || [])
        .map(a => a.toLowerCase().trim())
        .includes((answer || '').toLowerCase().trim());
    case 'ordering':
      if (!Array.isArray(answer) || answer.length !== q.words.length) return false;
      return answer.map(i => q.words[i]).join(' ') === q.correct.join(' ');
    case 'matching':
      return (q.pairs || []).every(p => answer?.[p.left] === p.right);
    case 'writing':
      return (answer?.text || '').trim().split(/\s+/).filter(Boolean).length >= 5;
    default:
      return false;
  }
}

function isAnswered(q, answer) {
  switch (q.type) {
    case 'multiple-choice': return answer !== undefined && answer !== null;
    case 'true-false':      return answer !== undefined && answer !== null;
    case 'fill-in-blank':   return (answer || '').trim().length > 0;
    case 'ordering':        return Array.isArray(answer) && answer.length === q.words.length;
    case 'matching':        return answer && Object.keys(answer).length === (q.pairs || []).length;
    case 'writing':         return true; // always allow next
    default: return false;
  }
}

function questionTypeLabel(type) {
  const labels = {
    'multiple-choice': 'Multiple Choice',
    'true-false': 'True or False',
    'fill-in-blank': 'Fill in the Blank',
    'ordering': 'Sentence Builder',
    'matching': 'Matching',
    'writing': 'Writing Task',
  };
  return labels[type] || type;
}

function questionTypeBadgeColor(type) {
  const colors = {
    'multiple-choice': 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    'true-false':      'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
    'fill-in-blank':   'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
    'ordering':        'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
    'matching':        'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
    'writing':         'bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300',
  };
  return colors[type] || 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300';
}

// ─── Question renderers (test mode) ──────────────────────────────────────────

function MCQuestion({ q, answer, setAnswer }) {
  return (
    <div className="space-y-3">
      {q.options.map((opt, idx) => {
        const isSel = answer === idx;
        return (
          <button key={idx} onClick={() => setAnswer(idx)}
            className={`w-full flex items-center gap-3 p-4 rounded-xl border-2 text-left transition-all ${
              isSel
                ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-100'
                : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:border-amber-300 dark:hover:border-amber-700'
            }`}>
            <span className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
              isSel ? 'bg-amber-500 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
            }`}>{String.fromCharCode(65 + idx)}</span>
            <span className="font-medium">{opt}</span>
          </button>
        );
      })}
    </div>
  );
}

function TrueFalseQuestion({ answer, setAnswer }) {
  return (
    <div className="flex gap-4">
      {[
        { val: true,  label: '✓ True',  sel: 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300' },
        { val: false, label: '✗ False', sel: 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' },
      ].map(({ val, label, sel }) => (
        <button key={String(val)} onClick={() => setAnswer(val)}
          className={`flex-1 py-5 rounded-xl border-2 font-bold text-xl transition-all ${
            answer === val
              ? sel
              : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500'
          }`}>
          {label}
        </button>
      ))}
    </div>
  );
}

function FillBlankQuestion({ q, answer, setAnswer }) {
  return (
    <div>
      <div className="font-mono text-base leading-relaxed bg-gray-50 dark:bg-gray-800 p-5 rounded-xl border-2 border-gray-200 dark:border-gray-700 mb-4 text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
        {q.sentence}
      </div>
      {q.blank_hint && (
        <p className="text-xs text-indigo-500 dark:text-indigo-400 mb-3 italic">{q.blank_hint}</p>
      )}
      <input
        type="text"
        value={answer || ''}
        onChange={e => setAnswer(e.target.value)}
        placeholder="Type the missing word(s)..."
        autoComplete="off"
        className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-amber-500 dark:focus:border-amber-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 text-lg"
      />
    </div>
  );
}

function MatchingQuestion({ q, answer = {}, setAnswer }) {
  const rightOptions = (q.pairs || []).map(p => p.right);
  return (
    <div className="space-y-3">
      {(q.pairs || []).map(pair => (
        <div key={pair.left} className="flex items-center gap-3">
          <div className="flex-1 min-w-0 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-xl px-4 py-3 text-indigo-900 dark:text-indigo-200 font-semibold text-sm truncate">
            {pair.left}
          </div>
          <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <select
            value={answer[pair.left] || ''}
            onChange={e => setAnswer({ ...answer, [pair.left]: e.target.value })}
            className="flex-1 min-w-0 px-3 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-amber-500 dark:focus:border-amber-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
          >
            <option value="">Choose...</option>
            {rightOptions.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      ))}
    </div>
  );
}

function OrderingQuestion({ q, answer = [], setAnswer }) {
  const usedIndices = new Set(answer);
  const addWord = idx => {
    if (!usedIndices.has(idx)) setAnswer([...answer, idx]);
  };
  const removeWord = pos => {
    setAnswer(answer.filter((_, i) => i !== pos));
  };
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Click words to build the sentence. Click a placed word to remove it.
        </p>
        {answer.length > 0 && (
          <button onClick={() => setAnswer([])}
            className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium flex-shrink-0 ml-2">
            Clear all
          </button>
        )}
      </div>
      <div className="min-h-14 p-3 mb-4 border-2 border-amber-300 dark:border-amber-600 rounded-xl bg-amber-50 dark:bg-amber-900/10 flex flex-wrap gap-2 items-center">
        {answer.length === 0 && (
          <span className="text-gray-400 dark:text-gray-500 text-sm italic">Your sentence appears here...</span>
        )}
        {answer.map((wordIdx, pos) => (
          <button key={pos} onClick={() => removeWord(pos)}
            className="px-3 py-1.5 bg-amber-500 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors">
            {q.words[wordIdx]} ×
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {q.words.map((word, idx) => (
          <button key={idx} onClick={() => addWord(idx)} disabled={usedIndices.has(idx)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border-2 transition-all ${
              usedIndices.has(idx)
                ? 'border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 opacity-40 cursor-not-allowed'
                : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 hover:border-amber-400 dark:hover:border-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20'
            }`}>
            {word}
          </button>
        ))}
      </div>
    </div>
  );
}

function WritingQuestion({ q, answer, setAnswer }) {
  const wordCount = (answer?.text || '').trim().split(/\s+/).filter(Boolean).length;
  return (
    <div>
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4 mb-4">
        <p className="font-semibold text-blue-900 dark:text-blue-200 text-sm mb-1">Writing Task:</p>
        <p className="text-blue-800 dark:text-blue-300 text-sm">{q.prompt}</p>
        {q.guidance && (
          <p className="text-blue-600 dark:text-blue-400 text-xs mt-2 italic">{q.guidance}</p>
        )}
      </div>
      <textarea
        value={answer?.text || ''}
        onChange={e => setAnswer({ text: e.target.value, done: true })}
        placeholder="Write your answer here..."
        rows={5}
        className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-amber-500 dark:focus:border-amber-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 resize-none mb-1"
      />
      <p className={`text-xs mb-3 ${wordCount >= 5 ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`}>
        {wordCount} word{wordCount !== 1 ? 's' : ''} {wordCount >= 5 ? '✓' : '(write at least 5 words to score)'}
      </p>
      {q.example_answer && (
        <details className="text-sm">
          <summary className="text-gray-500 dark:text-gray-400 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 select-none">
            See example answer
          </summary>
          <p className="mt-2 text-gray-600 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
            {q.example_answer}
          </p>
        </details>
      )}
    </div>
  );
}

// ─── Answer review (result screen) ───────────────────────────────────────────

function AnswerReview({ q, answer, isCorrect }) {
  const base = `p-4 rounded-xl border-2 ${isCorrect
    ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10'
    : 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10'}`;

  const Icon = isCorrect ? CheckCircle : XCircle;
  const iconColor = isCorrect ? 'text-green-500' : 'text-red-500';

  let details = null;

  switch (q.type) {
    case 'multiple-choice':
      details = (
        <>
          {!isCorrect && answer !== undefined && answer !== null && (
            <p className="text-xs text-red-600 dark:text-red-400 mb-0.5">Your answer: {q.options[answer]}</p>
          )}
          <p className="text-xs text-green-700 dark:text-green-400">Correct: {q.options[q.correct]}</p>
        </>
      );
      break;
    case 'true-false':
      details = (
        <>
          {!isCorrect && <p className="text-xs text-red-600 dark:text-red-400 mb-0.5">Your answer: {String(answer)}</p>}
          <p className="text-xs text-green-700 dark:text-green-400">Correct: {String(q.correct)}</p>
        </>
      );
      break;
    case 'fill-in-blank':
      details = (
        <>
          {!isCorrect && (answer || '').trim() && (
            <p className="text-xs text-red-600 dark:text-red-400 mb-0.5">Your answer: "{answer}"</p>
          )}
          <p className="text-xs text-green-700 dark:text-green-400">
            Accepted: {(q.accepted_answers || []).join(' / ')}
          </p>
        </>
      );
      break;
    case 'ordering': {
      const userSentence = Array.isArray(answer) ? answer.map(i => q.words[i]).join(' ') : '(not answered)';
      details = (
        <>
          {!isCorrect && <p className="text-xs text-red-600 dark:text-red-400 mb-0.5">Your answer: "{userSentence}"</p>}
          <p className="text-xs text-green-700 dark:text-green-400">Correct: "{(q.correct || []).join(' ')}"</p>
        </>
      );
      break;
    }
    case 'matching':
      details = (
        <div className="space-y-1 mt-1">
          {(q.pairs || []).map(p => {
            const userRight = answer?.[p.left];
            const pairOk = userRight === p.right;
            return (
              <p key={p.left} className={`text-xs ${pairOk ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {pairOk ? '✓' : '✗'} {p.left} → {p.right}
                {!pairOk && userRight && <span className="opacity-70"> (you said: {userRight})</span>}
              </p>
            );
          })}
        </div>
      );
      break;
    case 'writing':
      details = (
        <div>
          {(answer?.text || '').trim() ? (
            <p className="text-xs text-gray-600 dark:text-gray-400 italic mb-1">
              Your answer: "{answer.text}"
            </p>
          ) : (
            <p className="text-xs text-gray-400">Not answered</p>
          )}
          {q.example_answer && (
            <p className="text-xs text-green-700 dark:text-green-400">
              Example: "{q.example_answer}"
            </p>
          )}
          <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-1 italic">
            Self-assessed writing task
          </p>
        </div>
      );
      break;
  }

  return (
    <div className={base}>
      <div className="flex items-start gap-2">
        <Icon className={`w-5 h-5 ${iconColor} flex-shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${questionTypeBadgeColor(q.type)}`}>
              {questionTypeLabel(q.type)}
            </span>
          </div>
          <p className="font-medium text-gray-900 dark:text-white text-sm mb-1.5">
            {q.type === 'fill-in-blank' ? q.sentence : q.type === 'true-false' ? q.statement : q.question}
          </p>
          {details}
          {q.explanation && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 italic">{q.explanation}</p>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function UnitTest() {
  const { unitId } = useParams();
  const { token } = useAuth();

  const [testData, setTestData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState('intro');
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState({});
  const [result, setResult] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(false);
  const topRef = useRef(null);

  useEffect(() => {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    fetch(`/api/unit-tests/${unitId}`, { headers })
      .then(r => { if (!r.ok) throw new Error('not found'); return r.json(); })
      .then(data => { setTestData(data); setLoading(false); })
      .catch(() => { setTestData(null); setLoading(false); });
  }, [unitId, token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen dark:bg-gray-950">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!testData) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <Trophy className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Test not available yet</h1>
        <p className="text-gray-500 dark:text-gray-400 mb-6">The unit test for Unit {unitId} hasn't been added yet.</p>
        <Link to="/dashboard" className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium">← Back to Dashboard</Link>
      </div>
    );
  }

  const scoredQuestions = testData.questions || [];
  const previewQuestions = testData.preview_questions || [];
  const allQuestions = [...scoredQuestions, ...previewQuestions];
  const total = allQuestions.length;

  const typeCounts = scoredQuestions.reduce((acc, q) => {
    acc[q.type] = (acc[q.type] || 0) + 1;
    return acc;
  }, {});

  // ─── Intro ────────────────────────────────────────────────────────────────
  if (screen === 'intro') {
    const prev = testData.previous_result;
    const prevPassed = prev && prev.percentage >= 70;
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
              <Trophy className="w-7 h-7 text-amber-500" />
            </div>
            <div>
              <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">Unit {unitId} Test</p>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{testData.unit_title}</h1>
            </div>
          </div>

          {prev && (
            <div className={`flex items-center justify-between p-4 rounded-xl border-2 mb-6 ${
              prevPassed
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700'
                : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700'
            }`}>
              <div>
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-0.5">Previous attempt</p>
                <p className={`text-lg font-bold ${prevPassed ? 'text-green-700 dark:text-green-400' : 'text-amber-700 dark:text-amber-400'}`}>
                  {prev.score}/{scoredQuestions.length} — {Math.round(prev.percentage)}%
                  {prevPassed ? ' ✓ Passed' : ' — Try again'}
                </p>
              </div>
              <RotateCcw className={`w-5 h-5 ${prevPassed ? 'text-green-500' : 'text-amber-500'}`} />
            </div>
          )}

          <p className="text-gray-600 dark:text-gray-400 mb-6">{testData.description}</p>

          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-6">
            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">What's in this test</p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(typeCounts).map(([type, count]) => (
                <span key={type} className={`text-xs px-2.5 py-1 rounded-full font-medium ${questionTypeBadgeColor(type)}`}>
                  {count}× {questionTypeLabel(type)}
                </span>
              ))}
              {previewQuestions.length > 0 && (
                <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
                  {previewQuestions.length}× Preview (Unit {parseInt(unitId) + 1})
                </span>
              )}
            </div>
          </div>

          <button
            onClick={() => { setCurrentQ(0); setSelected({}); setScreen('test'); topRef.current?.scrollIntoView(); }}
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold text-lg transition-colors"
          >
            {prev ? 'Retake Test →' : 'Start Test →'}
          </button>
          <Link to="/dashboard" className="block text-center mt-4 text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400">
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // ─── Test ─────────────────────────────────────────────────────────────────
  if (screen === 'test') {
    const q = allQuestions[currentQ];
    const isPreview = !!q.is_preview;
    const isLast = currentQ === total - 1;
    const currentAnswer = selected[q.id];
    const answered = isAnswered(q, currentAnswer);

    const setCurrentAnswer = val => setSelected(prev => ({ ...prev, [q.id]: val }));

    const goTo = next => {
      setCurrentQ(next);
      topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const handleSubmit = async () => {
      setSubmitting(true);
      let score = 0;
      const answers = scoredQuestions.map(q => {
        const ans = selected[q.id];
        const correct = scoreQuestion(q, ans);
        if (correct) score++;
        return { question_id: q.id, type: q.type, selected: ans ?? null, correct };
      });
      const percentage = Math.round((score / scoredQuestions.length) * 100);

      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      try {
        const r = await fetch(`/api/unit-tests/${unitId}/submit`, {
          method: 'POST', headers,
          body: JSON.stringify({ score, percentage, answers })
        });
        if (r.status === 401) { window.dispatchEvent(new Event('auth:expired')); return; }
        if (!r.ok) throw new Error();
      } catch {
        setSubmitError(true);
        setSubmitting(false);
        return;
      }

      setResult({ score, percentage, answers });
      setScreen('result');
      setSubmitting(false);
    };

    const questionText = q.type === 'fill-in-blank'
      ? null
      : q.type === 'true-false'
      ? q.statement
      : q.question || q.instruction;

    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div ref={topRef} />
        {/* Progress */}
        <div className="mb-5">
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
            <span className="font-medium">Question {currentQ + 1} of {total}</span>
            {isPreview
              ? <span className="flex items-center gap-1 text-indigo-500 text-xs font-semibold"><Eye className="w-3.5 h-3.5" /> Preview</span>
              : <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${questionTypeBadgeColor(q.type)}`}>{questionTypeLabel(q.type)}</span>
            }
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-amber-500 rounded-full transition-all duration-300" style={{ width: `${((currentQ + 1) / total) * 100}%` }} />
          </div>
        </div>

        {/* Card */}
        <div className={`bg-white dark:bg-gray-900 rounded-2xl shadow-sm p-6 mb-4 ${isPreview ? 'border-2 border-indigo-200 dark:border-indigo-700' : ''}`}>
          {isPreview && (
            <div className="inline-flex items-center gap-1.5 bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 text-xs font-semibold px-3 py-1 rounded-full mb-4">
              <Eye className="w-3.5 h-3.5" /> Preview: Unit {q.preview_unit} — {q.preview_unit_title}
            </div>
          )}
          {q.type === 'writing' && (
            <div className="flex items-center gap-2 mb-3">
              <Pencil className="w-4 h-4 text-pink-500" />
              <span className="text-xs font-semibold text-pink-600 dark:text-pink-400 uppercase tracking-wide">Writing Task</span>
            </div>
          )}
          {questionText && (
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-5">{questionText}</h2>
          )}

          {q.type === 'multiple-choice' && <MCQuestion q={q} answer={currentAnswer} setAnswer={setCurrentAnswer} />}
          {q.type === 'true-false' && <TrueFalseQuestion answer={currentAnswer} setAnswer={setCurrentAnswer} />}
          {q.type === 'fill-in-blank' && <FillBlankQuestion q={q} answer={currentAnswer} setAnswer={setCurrentAnswer} />}
          {q.type === 'matching' && <MatchingQuestion q={q} answer={currentAnswer} setAnswer={setCurrentAnswer} />}
          {q.type === 'ordering' && <OrderingQuestion q={q} answer={currentAnswer} setAnswer={setCurrentAnswer} />}
          {q.type === 'writing' && <WritingQuestion q={q} answer={currentAnswer} setAnswer={setCurrentAnswer} />}
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          {currentQ > 0 && (
            <button onClick={() => goTo(currentQ - 1)}
              className="flex items-center gap-2 px-5 py-2.5 border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:border-gray-400 transition-colors">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          )}
          <div className="flex-1" />
          {isLast ? (
            <div className="flex flex-col items-end gap-1">
              {submitError && (
                <p className="text-xs text-red-500 dark:text-red-400">Could not save — check connection and retry.</p>
              )}
              <button onClick={() => { setSubmitError(false); handleSubmit(); }} disabled={submitting}
                className="flex items-center gap-2 px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-semibold disabled:opacity-60 transition-colors">
                {submitting ? 'Submitting...' : 'Submit Test'} <CheckCircle className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button onClick={() => goTo(currentQ + 1)} disabled={!answered && q.type !== 'writing'}
              className="flex items-center gap-2 px-6 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white rounded-xl font-semibold disabled:cursor-not-allowed transition-colors">
              Next <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // ─── Result ───────────────────────────────────────────────────────────────
  if (screen === 'result' && result) {
    const { score, percentage, answers } = result;
    const passed = percentage >= 70;
    const scoreColor = percentage >= 70 ? 'text-green-600 dark:text-green-400' : percentage >= 50 ? 'text-amber-500 dark:text-amber-400' : 'text-red-600 dark:text-red-400';
    const barColor = percentage >= 70 ? 'bg-green-500' : percentage >= 50 ? 'bg-amber-500' : 'bg-red-500';
    const borderColor = percentage >= 70 ? 'border-green-200 dark:border-green-700' : percentage >= 50 ? 'border-amber-200 dark:border-amber-700' : 'border-red-200 dark:border-red-700';

    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        {/* Score banner */}
        <div className={`bg-white dark:bg-gray-900 rounded-2xl shadow-sm p-8 border-2 ${borderColor} text-center`}>
          <div className={`text-6xl font-bold ${scoreColor} mb-1`}>{score}/{scoredQuestions.length}</div>
          <div className={`text-3xl font-semibold ${scoreColor} mb-4`}>{percentage}%</div>
          {passed ? (
            <>
              <p className="text-2xl font-bold text-green-700 dark:text-green-400">Ku guuleystay! 🎉</p>
              <p className="text-green-600 dark:text-green-500">Well done — you passed Unit {unitId}!</p>
            </>
          ) : (
            <>
              <p className="text-2xl font-bold text-red-700 dark:text-red-400">Isku day mar kale</p>
              <p className="text-red-600 dark:text-red-500">Keep practising — you can do it!</p>
            </>
          )}
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mt-5">
            <div className={`h-full rounded-full ${barColor}`} style={{ width: `${percentage}%` }} />
          </div>
        </div>

        {/* Answer breakdown */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm p-6">
          <h2 className="font-bold text-gray-900 dark:text-white text-lg mb-4">Answer Review</h2>
          <div className="space-y-3">
            {scoredQuestions.map((q) => {
              const a = answers.find(a => a.question_id === q.id);
              return <AnswerReview key={q.id} q={q} answer={a?.selected} isCorrect={a?.correct} />;
            })}
          </div>
        </div>

        {/* Preview */}
        {previewQuestions.length > 0 && (
          <div className="bg-indigo-50 dark:bg-indigo-900/20 border-2 border-indigo-200 dark:border-indigo-700 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Eye className="w-5 h-5 text-indigo-500" />
              <h2 className="font-bold text-indigo-900 dark:text-indigo-200 text-lg">
                Coming up in Unit {parseInt(unitId) + 1}...
              </h2>
            </div>
            <div className="space-y-4">
              {previewQuestions.map(q => (
                <div key={q.id} className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-indigo-200 dark:border-indigo-700">
                  <p className="text-xs font-semibold text-indigo-500 mb-2">{q.preview_unit_title}</p>
                  <p className="font-medium text-gray-900 dark:text-white text-sm mb-2">{q.question}</p>
                  <p className="text-xs text-green-700 dark:text-green-400">Answer: {q.options[q.correct]}</p>
                  {q.explanation && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">{q.explanation}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3">
          <Link to="/dashboard"
            className="flex-1 py-3 text-center border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:border-gray-400 dark:hover:border-gray-500 transition-colors">
            <ArrowLeft className="w-4 h-4 inline mr-1.5" /> Dashboard
          </Link>
          {!passed && (
            <button onClick={() => { setCurrentQ(0); setSelected({}); setResult(null); setScreen('test'); }}
              className="flex-1 py-3 flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold transition-colors">
              <RotateCcw className="w-4 h-4" /> Retake Test
            </button>
          )}
        </div>
      </div>
    );
  }

  return null;
}
