import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ChevronLeft, Clock, Volume2, PenLine } from 'lucide-react';
import { apiFetch } from '../utils/api';

function fmt(s) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r < 10 ? '0' : ''}${r}`;
}

function TaskCard({ title, icon, task, draftKey, audio }) {
  const Icon = icon;
  const [started, setStarted] = useState(false);
  const [left, setLeft] = useState((task.minutes || 30) * 60);
  const [text, setText] = useState(() => {
    try { return localStorage.getItem(draftKey) || ''; } catch { return ''; }
  });
  const [state, setState] = useState('idle'); // idle | writing | grading | done
  const [result, setResult] = useState(null);
  const timer = useRef(null);

  useEffect(() => () => clearInterval(timer.current), []);

  const start = () => {
    setStarted(true);
    setState('writing');
    timer.current = setInterval(() => {
      setLeft((s) => {
        if (s <= 1) { clearInterval(timer.current); return 0; }
        return s - 1;
      });
    }, 1000);
  };

  const words = text.trim().split(/\s+/).filter(Boolean).length;

  const submit = async () => {
    clearInterval(timer.current);
    setState('grading');
    try {
      const res = await apiFetch('/api/writing/assess', {
        method: 'POST',
        body: JSON.stringify({ writing_text: text, prompt_instruction: task.prompt, min_words: task.min_words || 150 }),
      });
      setResult(res.ok ? await res.json() : { score: null, passed: true, feedback: 'Submitted. Automatic feedback is unavailable right now.' });
    } catch {
      setResult({ score: null, passed: true, feedback: 'Submitted. Automatic feedback is unavailable right now.' });
    }
    setState('done');
  };

  const timeUp = left === 0;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-indigo-500" />
          <p className="font-semibold text-gray-900 dark:text-white">{title}</p>
        </div>
        {started && (
          <span className={`flex items-center gap-1 text-sm font-medium ${timeUp ? 'text-red-500' : 'text-gray-600 dark:text-gray-400'}`}>
            <Clock className="w-4 h-4" /> {fmt(left)}
          </span>
        )}
      </div>

      {audio && (
        <div className="mb-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1 flex items-center gap-1"><Volume2 className="w-3.5 h-3.5" /> Listen, then write your response:</p>
          <audio controls preload="none" src={audio} className="w-full" />
        </div>
      )}

      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-4">
        <p className="text-gray-800 dark:text-gray-200 text-sm leading-relaxed">{task.prompt}</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          {task.minutes} min · {task.min_words}–{task.max_words} words
        </p>
      </div>

      {!started ? (
        <button onClick={start} className="w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700">
          Start ({task.minutes} min)
        </button>
      ) : state === 'done' ? (
        <div className={`rounded-xl p-5 ${result.passed ? 'bg-green-50 dark:bg-green-900/20 border-2 border-green-300 dark:border-green-700' : 'bg-orange-50 dark:bg-orange-900/20 border-2 border-orange-300 dark:border-orange-700'}`}>
          {result.score != null && <p className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{result.score}/100</p>}
          <p className="text-sm text-gray-700 dark:text-gray-300">{result.feedback}</p>
          {result.feedback_somali && <p className="text-sm text-indigo-600 dark:text-indigo-400 mt-2">{result.feedback_somali}</p>}
        </div>
      ) : (
        <>
          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); try { localStorage.setItem(draftKey, e.target.value); } catch { /* ignore */ } }}
            disabled={state === 'grading'}
            placeholder={timeUp ? 'Time is up — submit your work.' : 'Write your response here…'}
            className="w-full p-4 border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:border-indigo-500 focus:outline-none min-h-[220px] bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 mb-2"
          />
          <div className="flex items-center justify-between mb-3">
            <span className={`text-sm ${words >= (task.min_words || 0) ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
              {words} / {task.min_words} words
            </span>
            {timeUp && <span className="text-sm text-red-500 font-medium">Time is up</span>}
          </div>
          <button
            onClick={submit}
            disabled={state === 'grading' || words < 20}
            className="w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50"
          >
            {state === 'grading' ? 'Grading…' : 'Submit for grading'}
          </button>
        </>
      )}
    </div>
  );
}

export default function WritingExam() {
  const { unitId } = useParams();
  const navigate = useNavigate();
  const [exam, setExam] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    apiFetch(`/api/writing-exam/${unitId}`)
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('No exam for this unit'))))
      .then(setExam)
      .catch(e => setError(e.message));
  }, [unitId]);

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
        <button onClick={() => navigate('/progress')} className="text-indigo-600 dark:text-indigo-400 font-medium">← Back to Progress</button>
      </div>
    );
  }
  if (!exam) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" /></div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-4 sm:p-6">
      <button onClick={() => navigate('/progress')} className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4 text-sm">
        <ChevronLeft className="w-4 h-4" /> Progress
      </button>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Unit {exam.unit} Writing Exam</h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Two timed C1 tasks. Each timer starts when you press Start; your writing is graded by AI.</p>

      <div className="space-y-5">
        {exam.essay && <TaskCard title="Timed Essay" icon={PenLine} task={exam.essay} draftKey={`exam_${unitId}_essay`} />}
        {exam.listen_write && <TaskCard title="Listen &amp; Write" icon={Volume2} task={exam.listen_write} draftKey={`exam_${unitId}_lw`} audio={exam.listen_write.audio} />}
      </div>
    </div>
  );
}
