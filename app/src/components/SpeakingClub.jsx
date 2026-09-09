import { useState, useEffect } from 'react';
import { Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';

export default function SpeakingClub() {
  const { user } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    const level = ['A2', 'B1', 'B2', 'C1'].includes(user?.cefr_level) ? user.cefr_level : 'A2';
    let cancelled = false;
    apiFetch(`/api/practice/speaking-club?level=${level}`)
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (!cancelled) setData(d); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user]);

  if (!data?.prompt) return null;

  return (
    <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-2xl p-5 mb-6 shadow-md">
      <p className="flex items-center gap-2 text-purple-100 text-sm font-medium mb-1">
        <Users className="w-4 h-4" /> This week&rsquo;s speaking club
      </p>
      <p className="text-lg font-semibold leading-snug">{data.prompt}</p>
      <p className="text-purple-100 text-xs mt-2">Talk about this with a partner or group — in English!</p>
    </div>
  );
}
