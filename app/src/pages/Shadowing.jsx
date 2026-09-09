import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Volume2, Mic, Square, Play, ChevronRight, Repeat } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';

const LEVELS = ['A2', 'B1', 'B2', 'C1'];

export default function Shadowing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [level, setLevel] = useState(LEVELS.includes(user?.cefr_level) ? user.cefr_level : 'A2');
  const [items, setItems] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [idx, setIdx] = useState(0);
  const [recording, setRecording] = useState(false);
  const [recUrl, setRecUrl] = useState(null);
  const [micError, setMicError] = useState(false);

  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const audioRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch(`/api/practice/shadowing?level=${level}&n=8`)
      .then(r => (r.ok ? r.json() : { items: [] }))
      .then(d => { if (!cancelled) { setItems(d.items || []); setIdx(0); setRecUrl(null); } })
      .catch(() => { if (!cancelled) setItems([]); });
    return () => { cancelled = true; };
  }, [level, reloadKey]);

  useEffect(() => () => { audioRef.current?.pause(); if (recUrl) URL.revokeObjectURL(recUrl); }, [recUrl]);

  const item = items && items[idx];

  const playModel = () => {
    if (!item) return;
    audioRef.current?.pause();
    const a = new Audio(item.audio);
    audioRef.current = a;
    a.play().catch(() => {});
  };

  const startRec = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      recorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (e) => chunksRef.current.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        if (recUrl) URL.revokeObjectURL(recUrl);
        setRecUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(t => t.stop());
      };
      rec.start();
      setRecording(true);
      setMicError(false);
    } catch { setMicError(true); }
  };

  const stopRec = () => { recorderRef.current?.stop(); setRecording(false); };

  const playBoth = () => {
    if (!item) return;
    audioRef.current?.pause();
    const model = new Audio(item.audio);
    audioRef.current = model;
    model.onended = () => {
      if (recUrl) { const me = new Audio(recUrl); audioRef.current = me; me.play().catch(() => {}); }
    };
    model.play().catch(() => {});
  };

  const next = () => {
    audioRef.current?.pause();
    setRecUrl(null);
    if (idx + 1 >= items.length) setReloadKey(k => k + 1);
    else setIdx(i => i + 1);
  };

  if (!items) {
    return <div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" /></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/dashboard')} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
          <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        <div className="flex-1">
          <p className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-1.5"><Repeat className="w-4 h-4" /> Shadowing</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{Math.min(idx + 1, items.length)} of {items.length}</p>
        </div>
        <div className="flex gap-1">
          {LEVELS.map(l => (
            <button key={l} onClick={() => setLevel(l)} className={`px-2.5 py-1 rounded-lg text-xs font-medium ${level === l ? 'bg-indigo-600 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}>{l}</button>
          ))}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-8">
        {items.length === 0 ? (
          <p className="text-center text-gray-500 dark:text-gray-400 py-16">No sentences for this level yet.</p>
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 p-6">
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-2 text-center">Hear it, then say it the same way.</p>
            <p className="text-xl font-medium text-gray-900 dark:text-white text-center leading-relaxed mb-6">{item.text}</p>

            <div className="flex justify-center mb-4">
              <button onClick={playModel} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/50">
                <Volume2 className="w-5 h-5" /> Hear model
              </button>
            </div>

            <div className="flex justify-center gap-3 mb-4">
              {!recording ? (
                <button onClick={startRec} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-semibold hover:bg-red-100 border border-red-200 dark:border-red-800">
                  <Mic className="w-5 h-5" /> Record
                </button>
              ) : (
                <button onClick={stopRec} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 animate-pulse">
                  <Square className="w-5 h-5" /> Stop
                </button>
              )}
              {recUrl && !recording && (
                <button onClick={playBoth} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 font-semibold hover:bg-green-100 border border-green-200 dark:border-green-800">
                  <Play className="w-5 h-5" /> Play both
                </button>
              )}
            </div>

            {micError && <p className="text-center text-sm text-red-500 mb-4">Microphone access is needed to record.</p>}

            <button onClick={next} className="w-full py-3 bg-indigo-600 text-white rounded-lg font-semibold hover:bg-indigo-700 flex items-center justify-center gap-2">
              {idx + 1 >= items.length ? 'New set' : 'Next'} <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
