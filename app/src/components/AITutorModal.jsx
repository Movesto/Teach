import { useState, useEffect, useRef } from 'react';
import { X, Sparkles, Loader, Send, Globe } from 'lucide-react';

export default function AITutorModal({ isOpen, onClose, context }) {
  const [translation, setTranslation] = useState(null);
  const [explanation, setExplanation] = useState(null);
  const [explanationEnglish, setExplanationEnglish] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Chat state
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [showEnglish, setShowEnglish] = useState(true);

  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  // Reset state when modal opens with new context
  useEffect(() => {
    if (isOpen && context) {
      setTranslation(null);
      setExplanation(null);
      setExplanationEnglish(null);
      setChatMessages([]);
      setChatInput('');
      setError(null);
      getHelp();
    }
  }, [isOpen, context]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const getHelp = async () => {
    setLoading(true);
    setError(null);

    try {
      let textToTranslate = '';
      let additionalContext = '';

      const content = context.content || {};
      if (context.type === 'question') {
        textToTranslate = content.question || '';
        additionalContext = 'This is a quiz question.';
      } else if (context.type === 'drill') {
        textToTranslate = content.title || '';
        additionalContext = `Pattern drill: ${content.instruction || ''}`;
      } else if (context.type === 'phrase') {
        textToTranslate = content.text || '';
        additionalContext = content.context || '';
      } else {
        textToTranslate = JSON.stringify(content).substring(0, 500);
      }

      // Step 1: Translate with NLLB
      const nllbResponse = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: textToTranslate,
          source_lang: 'eng_Latn',
          target_lang: 'som_Latn'
        })
      });

      if (!nllbResponse.ok) throw new Error('Translation failed');

      const nllbData = await nllbResponse.json();
      setTranslation(nllbData.translation);

      // Step 2: Get explanation from Qwen
      const qwenResponse = await fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          english: textToTranslate,
          somali: nllbData.translation,
          context: additionalContext,
          type: context.type
        })
      });

      if (!qwenResponse.ok) throw new Error('Explanation failed');

      const qwenData = await qwenResponse.json();
      setExplanation(qwenData.explanation);
      setExplanationEnglish(qwenData.explanation_english);

      // Seed chat history with the initial explanation so Qwen has context
      setChatMessages([{
        role: 'assistant',
        content: qwenData.explanation,
        content_english: qwenData.explanation_english,
      }]);

    } catch (err) {
      console.error('AI Tutor error:', err);
      setError('Sorry, I couldn\'t get help right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const sendChatMessage = async () => {
    const message = chatInput.trim();
    if (!message || chatLoading) return;

    setChatInput('');
    setChatLoading(true);

    // Add user message to chat immediately
    const userMsg = {
      role: 'user',
      content: message,          // Somali text typed by user
      content_english: null,     // Will be filled by backend
    };
    const updatedMessages = [...chatMessages, userMsg];
    setChatMessages(updatedMessages);

    try {
      // Build lesson context string
      let lessonContext = '';
      if (context) {
        const c = context.content || {};
        if (context.type === 'question') lessonContext = c.question || '';
        else if (context.type === 'drill') lessonContext = c.title || '';
        else if (context.type === 'phrase') lessonContext = c.text || '';
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message,
          history: chatMessages, // previous messages (not including current)
          lesson_context: lessonContext,
        })
      });

      if (!response.ok) throw new Error('Chat failed');

      const data = await response.json();

      // Update user message with English translation and add assistant reply
      setChatMessages(prev => {
        const updated = [...prev];
        // Fill in English for the user message we just sent
        const lastUserIdx = updated.length - 1;
        updated[lastUserIdx] = {
          ...updated[lastUserIdx],
          content_english: data.user_message_english,
        };
        // Add assistant reply
        updated.push({
          role: 'assistant',
          content: data.reply,
          content_english: data.reply_english,
        });
        return updated;
      });
    } catch (err) {
      console.error('Chat error:', err);
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Waan ka xumahay, khalad ayaa dhacay. Fadlan isku day mar kale.',
        content_english: 'Sorry, an error occurred. Please try again.',
      }]);
    } finally {
      setChatLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="shrink-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900">AI Tutor</h3>
              <p className="text-sm text-gray-600">Help in Somali / Caawimo Af-Soomaali</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Globe toggle for English translations */}
            <button
              onClick={() => setShowEnglish(!showEnglish)}
              title={showEnglish ? 'Hide English' : 'Show English'}
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
                showEnglish
                  ? 'bg-blue-100 text-blue-600'
                  : 'hover:bg-gray-100 text-gray-400'
              }`}
            >
              <Globe className="w-5 h-5" />
            </button>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
            >
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader className="w-12 h-12 text-blue-600 animate-spin mb-4" />
              <p className="text-gray-600">Getting help from AI tutor...</p>
              <p className="text-sm text-gray-500">Tarjumaya...</p>
            </div>
          ) : error ? (
            <div className="bg-red-50 border-2 border-red-200 rounded-lg p-4">
              <p className="text-red-900 font-semibold mb-2">Error</p>
              <p className="text-red-800">{error}</p>
            </div>
          ) : (
            <>
              {/* Original English */}
              {context && context.content && (
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-5 border-2 border-blue-200">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm font-bold text-blue-700">English</span>
                  </div>
                  <p className="text-lg font-semibold text-blue-900 leading-relaxed">
                    {context.type === 'question' && context.content.question}
                    {context.type === 'drill' && context.content.title}
                    {context.type === 'phrase' && context.content.text}
                    {!['question', 'drill', 'phrase'].includes(context.type) &&
                      JSON.stringify(context.content).substring(0, 200)
                    }
                  </p>
                </div>
              )}

              {/* Somali Translation */}
              {translation && (
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-5 border-2 border-green-200">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-sm font-bold text-green-700">
                      Somali / Af-Soomaali
                    </span>
                  </div>
                  <p className="text-lg font-semibold text-green-900 leading-relaxed">
                    {translation}
                  </p>
                </div>
              )}

              {/* AI Explanation */}
              {explanation && (
                <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-5 border-2 border-amber-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-5 h-5 text-amber-600" />
                    <span className="text-sm font-bold text-amber-700">
                      Sharaxaad / Explanation
                    </span>
                  </div>
                  <div className="text-gray-800 leading-relaxed space-y-2">
                    {explanation.split('\n').map((paragraph, idx) => (
                      <p key={idx}>{paragraph}</p>
                    ))}
                  </div>
                  {showEnglish && explanationEnglish && (
                    <div className="mt-4 pt-4 border-t border-amber-200">
                      <p className="text-xs font-bold text-amber-600 mb-2">English version:</p>
                      <div className="text-sm text-amber-800 leading-relaxed space-y-1">
                        {explanationEnglish.split('\n').map((p, i) => (
                          <p key={i}>{p}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Chat Messages */}
              {chatMessages.length > 1 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-gray-200" />
                    <span className="text-xs font-bold text-gray-400 uppercase">
                      Chat / Wadahadal
                    </span>
                    <div className="h-px flex-1 bg-gray-200" />
                  </div>

                  {chatMessages.slice(1).map((msg, idx) => (
                    <div
                      key={idx}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                          msg.role === 'user'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        <p className="leading-relaxed">{msg.content}</p>
                        {showEnglish && msg.content_english && msg.role === 'user' && (
                          <p className="text-xs mt-2 pt-2 border-t border-blue-400 text-blue-200 leading-relaxed">
                            {msg.content_english}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}

                  {chatLoading && (
                    <div className="flex justify-start">
                      <div className="bg-gray-100 rounded-2xl px-4 py-3">
                        <Loader className="w-5 h-5 text-gray-400 animate-spin" />
                      </div>
                    </div>
                  )}

                  <div ref={chatEndRef} />
                </div>
              )}
            </>
          )}
        </div>

        {/* Chat input + close button */}
        {!loading && !error && (
          <div className="shrink-0 border-t border-gray-200 p-4 bg-gray-50 rounded-b-2xl space-y-3">
            {/* Chat input */}
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Su'aal ku qor Af-Soomaali... (Type in Somali)"
                disabled={chatLoading}
                className="flex-1 px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-400 focus:outline-none transition-colors disabled:opacity-50"
              />
              <button
                onClick={sendChatMessage}
                disabled={chatLoading || !chatInput.trim()}
                className="px-4 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Send className="w-5 h-5" />
              </button>
            </div>

            <button
              onClick={onClose}
              className="w-full py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
            >
              Close / Xir
            </button>
          </div>
        )}

        {/* Show close button when there's an error */}
        {!loading && error && (
          <div className="shrink-0 border-t border-gray-200 p-4 bg-gray-50 rounded-b-2xl">
            <button
              onClick={onClose}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
            >
              Close / Xir
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
