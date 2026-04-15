import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, MicOff, Volume2, ChevronLeft, Clock, RotateCcw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const DAILY_LIMIT = 3600; // 60 minutes

function fmt(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

export default function ConversationPractice() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [, setStatus] = useState(null);              // { used_seconds, remaining_seconds }
  const [messages, setMessages] = useState([]);
  const [elapsed, setElapsed] = useState(0);         // seconds used THIS session
  const [listening, setListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [transcript, setTranscript] = useState('');  // live mic text
  const [audioPlaying, setAudioPlaying] = useState(false);
  const [limitReached, setLimitReached] = useState(false);
  const [error, setError] = useState(null);
  const [started, setStarted] = useState(false);
  const [lastUserText, setLastUserText] = useState('');

  const recognitionRef = useRef(null);
  const audioRef = useRef(null);
  const timerRef = useRef(null);
  const replyDelayRef = useRef(null);
  const accumulatedRef = useRef('');   // running transcript across breath pauses
  const bottomRef = useRef(null);
  const elapsedRef = useRef(0);

  // Sync elapsed to ref so timer callback always has latest value
  useEffect(() => { elapsedRef.current = elapsed; }, [elapsed]);

  // Load status + today's history on mount
  useEffect(() => {
    fetch('/api/conversation/status', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => {
        if (r.status === 401) { window.dispatchEvent(new Event('auth:expired')); throw new Error(); }
        return r.json();
      })
      .then(data => {
        setStatus(data);
        setElapsed(data.used_seconds);
        elapsedRef.current = data.used_seconds;
        if (data.used_seconds >= DAILY_LIMIT) setLimitReached(true);
      })
      .catch(() => setError('Could not load session status.'));

    fetch('/api/conversation/history', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => { if (r.status === 401) { window.dispatchEvent(new Event('auth:expired')); throw new Error(); } return r.json(); })
      .then(data => { if (data.messages?.length) setMessages(data.messages); })
      .catch(() => {});
  }, [token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, transcript, loading]);

  // Timer — only runs when session is active
  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const startTimer = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => {
      setElapsed(prev => {
        const next = prev + 1;
        elapsedRef.current = next;
        if (next >= DAILY_LIMIT) {
          stopTimer();
          setLimitReached(true);
          stopListening();
        }
        return next;
      });
    }, 1000);
  }, [stopTimer]);

  // Cleanup on unmount — stop timer, release mic, cancel pending reply
  useEffect(() => () => {
    stopTimer();
    recognitionRef.current?.abort();
    clearTimeout(replyDelayRef.current);
  }, [stopTimer]);

  // Web Speech API setup
  const setupRecognition = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return null;
    const rec = new SR();
    rec.lang = 'en-US';
    rec.continuous = true;   // keep listening through breath pauses
    rec.interimResults = true;

    rec.onresult = (e) => {
      let interim = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          accumulatedRef.current += e.results[i][0].transcript + ' ';
        } else {
          interim += e.results[i][0].transcript;
        }
      }
      setTranscript(accumulatedRef.current + interim);
    };

    // onend fires when the user taps stop — send everything accumulated
    rec.onend = () => {
      setListening(false);
      const final = accumulatedRef.current.trim();
      if (final) {
        clearTimeout(replyDelayRef.current);
        replyDelayRef.current = setTimeout(() => sendMessage(final), 900);
      }
    };

    rec.onerror = (e) => {
      if (e.error !== 'no-speech') setError('Microphone error: ' + e.error);
      setListening(false);
    };
    return rec;
  };

  const startListening = () => {
    if (limitReached || loading || audioPlaying) return;
    if (!started) { setStarted(true); startTimer(); }
    setError(null);
    setTranscript('');
    accumulatedRef.current = '';
    const rec = setupRecognition();
    if (!rec) { setError('Your browser does not support voice input. Try Chrome.'); return; }
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  const toggleMic = () => {
    if (listening) stopListening();
    else startListening();
  };

  const retryLast = () => {
    if (!lastUserText) return;
    setMessages(prev => prev.slice(0, -1));
    setError(null);
    sendMessage(lastUserText);
  };

  const sendMessage = async (text) => {
    if (!text?.trim() || loading) return;
    setLastUserText(text);
    setTranscript('');
    setListening(false);
    recognitionRef.current?.stop();
    setLoading(true);
    setError(null);

    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);

    try {
      const res = await fetch('/api/conversation/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          message: text,
          history: messages,
          elapsed_seconds: elapsedRef.current,
        }),
      });

      if (res.status === 401) { window.dispatchEvent(new Event('auth:expired')); return; }
      if (res.status === 429) {
        setLimitReached(true);
        stopTimer();
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.detail || 'Something went wrong. Please try again.');
      }

      const data = await res.json();
      const assistantMsg = { role: 'assistant', content: data.reply, audio_url: data.audio_url };
      setMessages(prev => [...prev, assistantMsg]);

      // Play teacher audio
      if (data.audio_url) {
        setAudioPlaying(true);
        const audio = new Audio(data.audio_url);
        audioRef.current = audio;
        audio.onended = () => setAudioPlaying(false);
        audio.onerror = () => setAudioPlaying(false);
        audio.play().catch(() => setAudioPlaying(false));
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const remaining = Math.max(0, DAILY_LIMIT - elapsed);
  const usedPct = Math.min(100, (elapsed / DAILY_LIMIT) * 100);
  const timerColor = remaining < 300 ? 'text-red-500' : remaining < 600 ? 'text-amber-500' : 'text-green-600 dark:text-green-400';

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">

      {/* Top bar */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/dashboard')} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        <div className="flex-1">
          <p className="font-bold text-gray-900 dark:text-white text-sm">Mr. Hassan</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">English Conversation Practice</p>
        </div>
        <div className={`flex items-center gap-1.5 text-sm font-mono font-bold ${timerColor}`}>
          <Clock className="w-4 h-4" />
          {fmt(remaining)}
        </div>
      </div>

      {/* Time bar */}
      <div className="h-1 bg-gray-200 dark:bg-gray-800">
        <div
          className={`h-full transition-all duration-1000 ${remaining < 300 ? 'bg-red-500' : remaining < 600 ? 'bg-amber-500' : 'bg-green-500'}`}
          style={{ width: `${100 - usedPct}%` }}
        />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4 max-w-2xl mx-auto w-full">

        {/* Intro card — shown before first message */}
        {messages.length === 0 && !loading && (
          <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-sm text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center mx-auto mb-4 text-4xl">
              👨‍🏫
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Mr. Hassan</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              25+ years teaching English · Patient · Encouraging
            </p>
            <p className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed mb-5">
              Tap the microphone and start speaking in English. Mr. Hassan will listen, reply, and help you improve. Talk about anything — your day, shopping, work, or ask for help with English.
            </p>
            <div className="flex items-center justify-center gap-2 text-xs text-gray-400 dark:text-gray-500">
              <Clock className="w-3.5 h-3.5" />
              {fmt(remaining)} available today
            </div>
          </div>
        )}

        {/* Message bubbles */}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} items-end gap-2`}>
            {msg.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-sm flex-shrink-0 mb-1">
                👨‍🏫
              </div>
            )}
            <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              msg.role === 'user'
                ? 'bg-indigo-600 text-white rounded-br-sm'
                : 'bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 shadow-sm rounded-bl-sm'
            }`}>
              {msg.content}
              {msg.role === 'user' && (
                <button
                  onClick={() => new Audio(`/api/tts?text=${encodeURIComponent(msg.content)}`).play()}
                  className="mt-1.5 flex items-center gap-1 text-xs text-indigo-200 hover:text-white"
                  title="Hear correct pronunciation"
                >
                  <Volume2 className="w-3 h-3" /> Hear it
                </button>
              )}
              {msg.role === 'assistant' && msg.audio_url && (
                <button
                  onClick={() => {
                    const a = new Audio(msg.audio_url);
                    a.play();
                  }}
                  className="mt-2 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 hover:text-amber-700 dark:hover:text-amber-300"
                >
                  <Volume2 className="w-3.5 h-3.5" /> Play again
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Live transcript */}
        {transcript && (
          <div className="flex justify-end">
            <div className="max-w-[78%] rounded-2xl rounded-br-sm px-4 py-3 text-sm bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 italic">
              {transcript}
            </div>
          </div>
        )}

        {/* Loading (Mr. Hassan typing) */}
        {loading && (
          <div className="flex items-end gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-sm flex-shrink-0">
              👨‍🏫
            </div>
            <div className="bg-white dark:bg-gray-900 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm flex gap-1 items-center">
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        )}

        {/* Limit reached */}
        {limitReached && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4 text-center">
            <p className="font-semibold text-amber-800 dark:text-amber-300 mb-1">Daily session complete</p>
            <p className="text-sm text-amber-700 dark:text-amber-400">
              You've used your 60 minutes for today. Come back tomorrow to continue practicing with Mr. Hassan.
            </p>
          </div>
        )}

        {error && (
          <div className="text-center">
            <p className="text-xs text-red-500 dark:text-red-400 mb-1">{error}</p>
            {lastUserText && (
              <button onClick={retryLast} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">
                Try again
              </button>
            )}
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Mic control */}
      {!limitReached && (
        <div className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 px-4 py-5">
          <div className="max-w-2xl mx-auto flex flex-col items-center gap-3">
            <button
              onClick={toggleMic}
              disabled={loading || audioPlaying}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg
                ${listening
                  ? 'bg-red-500 hover:bg-red-600 scale-110 shadow-red-300 dark:shadow-red-900'
                  : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-300 dark:shadow-indigo-900'
                }
                disabled:opacity-40 disabled:cursor-not-allowed disabled:scale-100`}
            >
              {listening
                ? <MicOff className="w-7 h-7 text-white" />
                : <Mic className="w-7 h-7 text-white" />
              }
            </button>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {audioPlaying ? 'Mr. Hassan is speaking...' : listening ? 'Listening... tap to stop' : 'Tap to speak'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
