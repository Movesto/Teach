import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Volume2, RotateCcw, ChevronRight, Ear } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';

const LEVELS = ['A2', 'B1', 'B2', 'C1'];
const SPEEDS = [0.75, 1, 1.25];

export default function Dictation() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [level, setLevel] = useState(LEVELS.includes(user?.cefr_level) ? user.cefr_level : 'A2');
  const [items, setItems] = useState(null);
  const [idx, setIdx] = useState(0);
  const [typed, setTyped] = useState('');
  const [result, setResult] = useState(null);
  const [scores, setScores] = useState([]);
  const [done, setDone] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [speed, setSpeed] = useState(1);
  const audioRef = useRef(null);
  const speedRef = useRef(1);
  useEffect(() => { speedRef.current = speed; }, [speed]);

  useEffect(() => {
    let cancelled = false;
    apiFetch(`/api/practice/dictation?level=${level}&n=10`)
      .then(r => (r.ok ? r.json() : { items: [] }))
      .then(d => {
        if (cancelled) return;
        setItems(d.items || []); setIdx(0); setTyped(''); setResult(null); setScores([]); setDone(false);
      })
      .catch(() => { if (!cancelled) setItems([]); });
    return () => { cancelled = true; };
  }, [level, reloadKey]);

  const item = items && items[idx];

  const play = () => {
    if (!item) return;
    audioRef.current?.pause();
    const a = new Audio(item.audio);
    a.playbackRate = speedRef.current;
    audioRef.current = a;
    a.play().catch(() => {});
  };

  // auto-play each new sentence (reads speed via ref so a speed change alone
  // doesn't replay the sentence)
  useEffect(() => {
    if (item && !result) {
      audioRef.current?.pause();
      const a = new Audio(item.audio);
      a.playbackRate = speedRef.current;
      audioRef.current = a;
      a.play().catch(() => {});
    }
  }, [item, result]);

  const check = async () => {
    if (!item || !typed.trim()) return;
    try {
      const res = await apiFetch(`/api/practice/dictation/${item.id}/check`, {
        method: 'POST', body: JSON.stringify({ typed }),
      });
      const data = await res.json();
      setResult(data);
      setScores(s => [...s, data.score]);
    } catch { /* ignore */ }
  };

  const next = () => {
    setResult(null); setTyped('');
    if (idx + 1 >= items.length) setDone(true);
    else setIdx(i => i + 1);
  };

  if (!items) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" /></div>;
  }

  const avg = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/dashboard')} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
          <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        <div className="flex-1">
          <p className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-1.5"><Ear className="w-4 h-4" /> Dictation</p>
          {!done && <p className="text-xs text-gray-500 dark:text-gray-400">{Math.min(idx + 1, items.length)} of {items.length}</p>}
        </div>
        <div className="flex gap-1">
          {LEVELS.map(l => (
            <button key={l} onClick={() => setLevel(l)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium ${level === l ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8">
        {items.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-16">No dictation sentences for this level yet.</p>
        ) : done ? (
          <div className="text-center py-10">
            <div className="text-5xl mb-3">{avg >= 90 ? '🌟' : avg >= 70 ? '👍' : '💪'}</div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">Session complete</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Average accuracy: {avg}%</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setReloadKey(k => k + 1)} className="flex items-center gap-2 px-5 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
                <RotateCcw className="w-4 h-4" /> Again
              </button>
              <button onClick={() => navigate('/dashboard')} className="px-5 py-2.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">Done</button>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 text-center">Listen and type exactly what you hear.</p>
            <div className="flex flex-col items-center gap-3 mb-6">
              <button onClick={play} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/50">
                <Volume2 className="w-5 h-5" /> Play again
              </button>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400 dark:text-gray-500">Speed</span>
                {SPEEDS.map(s => (
                  <button key={s} onClick={() => setSpeed(s)}
                    className={`px-2 py-0.5 rounded-md text-xs font-medium ${speed === s ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>{s}×</button>
                ))}
              </div>
            </div>

            {!result ? (
              <>
                <textarea
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); check(); } }}
                  autoFocus
                  placeholder="Type what you hear…"
                  className="w-full p-4 border-2 border-gray-200 dark:border-gray-600 rounded-lg focus:border-indigo-500 focus:outline-none min-h-[90px] bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 mb-4"
                />
                <button onClick={check} disabled={!typed.trim()} className="w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50">
                  Check
                </button>
              </>
            ) : (
              <>
                <div className="text-center mb-4">
                  <p className={`text-3xl font-bold ${result.score >= 90 ? 'text-green-600 dark:text-green-400' : result.score >= 70 ? 'text-amber-500' : 'text-red-500'}`}>{result.score}%</p>
                </div>
                <div className="mb-2 text-sm">
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">You typed:</p>
                  <p className="leading-relaxed">
                    {result.diff.map((d, i) => (
                      <span key={i} className={d.ok ? 'text-green-600 dark:text-green-400' : 'text-red-500 line-through'}>{d.word} </span>
                    ))}
                  </p>
                </div>
                <div className="mb-5 text-sm">
                  <p className="text-xs text-gray-400 dark:text-gray-500 mb-1">Correct:</p>
                  <p className="text-gray-900 dark:text-white leading-relaxed">{result.target}</p>
                </div>
                <button onClick={next} className="w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 flex items-center justify-center gap-2">
                  {idx + 1 >= items.length ? 'Finish' : 'Next'} <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
