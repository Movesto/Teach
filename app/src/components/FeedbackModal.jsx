import { useState } from 'react';
import { X, Star, Send, CheckCircle } from 'lucide-react';
import { apiFetch } from '../utils/api';

export default function FeedbackModal({ isOpen, onClose, context = {} }) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen) return null;

  const reset = () => {
    setRating(0);
    setHovered(0);
    setMessage('');
    setDone(false);
    setError(null);
  };

  const handleClose = () => { reset(); onClose(); };

  const submit = async () => {
    if (!rating) { setError('Please select a star rating.'); return; }
    setSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch('/api/feedback', {
        method: 'POST',
        body: JSON.stringify({
          rating,
          message,
          lesson_id: context.lessonId || null,
          lesson_title: context.lessonTitle || null,
          page: context.page || 'general',
        }),
      });
      if (!res.ok) throw new Error();
      setDone(true);
    } catch {
      setError('Could not submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const LABELS = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-700">
          <p className="font-bold text-gray-900 dark:text-white">
            {context.lessonTitle ? `Feedback: ${context.lessonTitle}` : 'Share Your Feedback'}
          </p>
          <button onClick={handleClose} className="w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center justify-center">
            <X className="w-4 h-4 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        <div className="px-5 py-5">
          {done ? (
            <div className="flex flex-col items-center py-6 gap-3">
              <CheckCircle className="w-12 h-12 text-green-500" />
              <p className="font-semibold text-gray-900 dark:text-white text-lg">Thank you!</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 text-center">Your feedback helps us improve the app.</p>
              <button
                onClick={handleClose}
                className="mt-2 px-6 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700"
              >
                Close
              </button>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                {context.page === 'general' || !context.page
                  ? 'How are you finding the app overall?'
                  : 'How was this lesson?'}
              </p>

              <div className="flex justify-center gap-2 mb-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    onMouseEnter={() => setHovered(n)}
                    onMouseLeave={() => setHovered(0)}
                    onClick={() => setRating(n)}
                    className="transition-transform hover:scale-110"
                  >
                    <Star
                      className={`w-9 h-9 ${
                        n <= (hovered || rating)
                          ? 'text-yellow-400 fill-yellow-400'
                          : 'text-gray-300 dark:text-gray-600'
                      }`}
                    />
                  </button>
                ))}
              </div>
              <p className="text-center text-sm font-medium text-indigo-600 dark:text-indigo-400 mb-4 h-5">
                {LABELS[hovered || rating]}
              </p>

              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Tell us more (optional)..."
                rows={3}
                maxLength={2000}
                className="w-full resize-none px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-xl focus:border-indigo-400 dark:focus:border-indigo-500 focus:outline-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 text-sm"
              />
              <p className="text-xs text-gray-400 dark:text-gray-500 text-right mt-1">{message.length}/2000</p>

              {error && <p className="text-xs text-red-500 dark:text-red-400 mt-2">{error}</p>}

              <button
                onClick={submit}
                disabled={submitting}
                className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-medium text-sm disabled:opacity-50 transition-colors"
              >
                <Send className="w-4 h-4" />
                {submitting ? 'Sending...' : 'Submit Feedback'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
