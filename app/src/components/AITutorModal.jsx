import { useState, useEffect, useRef } from 'react';
import { X, Sparkles, Loader, Send } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

// Load all unit titles once so the AI knows the full curriculum
const UNITS_SUMMARY = [
  "Unit 1: Daily Life & Survival — greetings, shopping, transport, health, emergencies",
  "Unit 2: People, Work & First Steps — family, job skills, interviews",
  "Unit 3: Work & Money — workplace, finances, smart shopping",
  "Unit 4: Community & Civic Life — post office, library, DMV, local services",
  "Unit 5: Opinions & Discussions — views, current events, entertainment, social plans",
  "Unit 6: Health & Wellbeing — doctors, pharmacy, mental health",
  "Unit 7: Travel & the World — directions, travel, cultures",
  "Unit 8: Education & Learning — schools, studying, goals",
  "Unit 9: Technology & Modern Life — internet, phones, digital skills",
  "Unit 10: Rights & Responsibilities — laws, citizenship, rights",
  "Unit 11: Advanced Communication — presentations, debates, formal writing",
  "Unit 12: Culture & Identity — traditions, identity, storytelling",
  "Unit 13: Future & Ambitions — goals, careers, the future",
].join("; ");

function buildLessonContext(context) {
  if (!context) return '';
  const c = context.content || {};
  if (context.type === 'question') return `quiz question: "${c.question || ''}"`;
  if (context.type === 'drill') return `pattern drill: "${c.title || ''}" — ${c.instruction || ''}`;
  if (context.type === 'phrase') return `phrase: "${c.text || ''}"`;
  if (context.type === 'lesson') return c.title || '';
  return '';
}

export default function AITutorModal({ isOpen, onClose, context }) {
  const { token } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUserText, setLastUserText] = useState('');
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Reset and send opening message whenever the modal opens
  useEffect(() => {
    if (!isOpen) return;
    setInput('');
    setError(null);
    setLoading(true);

    const lessonCtx = buildLessonContext(context);
    const openingPrompt = lessonCtx
      ? `I'm studying ${lessonCtx}. Can you help me understand it and practice?`
      : "Hello! I want to practice my English. Can you help me?";

    const initial = { role: 'user', content: openingPrompt, content_english: openingPrompt, hidden: true };
    setMessages([initial]);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        message: openingPrompt,
        history: [],
        lesson_context: lessonCtx,
        units_context: UNITS_SUMMARY,
      }),
      signal: controller.signal,
    })
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(data => {
        setMessages([initial, { role: 'assistant', content: data.reply, content_english: data.reply_english }]);
      })
      .catch(err => {
        if (err.name === 'AbortError') setError('Request timed out. Please try again.');
        else setError('Could not connect to AI tutor. Please try again.');
      })
      .finally(() => { clearTimeout(timeout); setLoading(false); });

    return () => { controller.abort(); clearTimeout(timeout); };
  }, [isOpen, context, token]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const retry = () => {
    if (!lastUserText) return;
    // Remove the pending user message (the one with no reply)
    setMessages(prev => prev.slice(0, -1));
    setError(null);
    sendText(lastUserText);
  };

  const send = () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput('');
    sendText(text);
  };

  const sendText = async (text) => {
    setLastUserText(text);
    setLoading(true);
    setError(null);

    const userMsg = { role: 'user', content: text, content_english: null };
    const next = [...messages, userMsg];
    setMessages(next);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          message: text,
          history: next.filter(m => !m.hidden),
          lesson_context: buildLessonContext(context),
          units_context: UNITS_SUMMARY,
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMessages(prev => {
        const updated = [...prev];
        updated[updated.length - 1] = { ...updated[updated.length - 1], content_english: data.user_message_english };
        return [...updated, { role: 'assistant', content: data.reply, content_english: data.reply_english }];
      });
    } catch (err) {
      if (err.name === 'AbortError') setError('Request timed out. Please try again.');
      else setError('Something went wrong. Please try again.');
    } finally {
      clearTimeout(timeout);
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  if (!isOpen) return null;

  const visibleMessages = messages.filter(m => !m.hidden);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white dark:bg-gray-900 rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl flex flex-col" style={{ height: '85vh' }}>

        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-bold text-gray-900 dark:text-white text-sm">AI Tutor</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">English · Somali · Any topic</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {visibleMessages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-br-sm'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-bl-sm'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 dark:bg-gray-800 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}

          {error && (
            <div className="text-center">
              <p className="text-xs text-red-500 dark:text-red-400 mb-1">{error}</p>
              {lastUserText && (
                <button
                  onClick={retry}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Try again
                </button>
              )}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 rounded-b-2xl">
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask in English or Somali..."
              disabled={loading}
              className="flex-1 resize-none px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:border-blue-400 dark:focus:border-blue-500 focus:outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 text-sm transition-colors disabled:opacity-50"
              style={{ maxHeight: '120px', overflowY: 'auto' }}
              onInput={e => {
                e.target.style.height = 'auto';
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
              }}
            />
            <button
              onClick={send}
              disabled={loading || !input.trim()}
              className="w-10 h-10 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
