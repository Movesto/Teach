import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Printer, Award } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';

const CEFR_NAME = {
  A1: 'Beginner', A2: 'Elementary', B1: 'Intermediate',
  B2: 'Upper-Intermediate', C1: 'Advanced', C2: 'Proficient',
};

export default function Certificate() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [latest, setLatest] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    apiFetch('/api/placement/history')
      .then(r => (r.ok ? r.json() : { attempts: [] }))
      .then(d => { setLatest((d.attempts || []).slice(-1)[0] || null); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, []);

  const cefr = latest?.cefr || user?.cefr_level || 'A1';
  const date = latest?.taken_at ? new Date(latest.taken_at) : new Date();
  const dateStr = date.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <style>{`@media print { nav, .no-print { display: none !important; } body { background: #fff !important; } .cert-page { padding: 0 !important; } }`}</style>

      <div className="no-print bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/progress')} className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
          <ChevronLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </button>
        <p className="font-bold text-gray-900 dark:text-white text-sm flex-1">Certificate</p>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium"
        >
          <Printer className="w-4 h-4" /> Print / Save PDF
        </button>
      </div>

      <div className="cert-page max-w-3xl mx-auto px-4 py-8">
        {/* Certificate */}
        <div className="bg-white text-gray-900 rounded-2xl border-[6px] border-double border-indigo-300 shadow-lg p-10 sm:p-14 text-center relative">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-indigo-100 flex items-center justify-center">
              <Award className="w-9 h-9 text-indigo-600" />
            </div>
          </div>
          <p className="text-sm uppercase tracking-[0.3em] text-indigo-600 font-semibold">Barashada Ingiriisiga</p>
          <h1 className="mt-4 text-3xl sm:text-4xl font-serif font-bold">Certificate of Progress</h1>
          <p className="mt-6 text-gray-500 text-sm">This certifies that</p>
          <p className="mt-2 text-2xl sm:text-3xl font-serif font-semibold text-gray-900">
            {user?.name || 'Learner'}
          </p>
          <p className="mt-6 text-gray-600 max-w-lg mx-auto leading-relaxed">
            has reached English level
          </p>
          <p className="mt-3 text-4xl font-bold text-indigo-600">
            CEFR {cefr}
            <span className="block text-base font-medium text-gray-500 mt-1">{CEFR_NAME[cefr] || ''}</span>
          </p>
          {latest?.percentage != null && (
            <p className="mt-4 text-sm text-gray-500">Assessment score: {Math.round(latest.percentage)}%</p>
          )}
          <p className="mt-8 text-sm text-gray-500">Awarded on {dateStr}</p>

          <div className="mt-10 pt-6 border-t border-gray-200 text-xs text-gray-400 max-w-xl mx-auto leading-relaxed">
            Issued by Barashada Ingiriisiga, a free self-paced English learning app, based on
            the learner&rsquo;s in-app placement / progress assessment. This records practice
            progress and is not an accredited qualification.
          </div>
        </div>

        {loaded && !latest && (
          <p className="no-print text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
            Take a progress check to record an assessment score on your certificate.
          </p>
        )}
      </div>
    </div>
  );
}
