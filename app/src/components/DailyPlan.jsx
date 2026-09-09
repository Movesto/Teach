import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, Repeat, Ear, BookMarked, MessageCircle, ChevronRight, Mic, CalendarCheck, Globe } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { apiFetch } from '../utils/api';

const B1_PLUS = ['B1', 'B2', 'C1'];

export default function DailyPlan() {
  const { user } = useAuth();
  const [due, setDue] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [homework, setHomework] = useState(0);

  useEffect(() => {
    apiFetch('/api/vocabulary/due').then(r => (r.ok ? r.json() : null)).then(d => setDue(d?.words?.length ?? 0)).catch(() => {});
    apiFetch('/api/practice/mistakes').then(r => (r.ok ? r.json() : null)).then(d => setMistakes(d?.mistakes?.length ?? 0)).catch(() => {});
    apiFetch('/api/practice/homework').then(r => (r.ok ? r.json() : null)).then(d => setHomework(d?.pending ?? 0)).catch(() => {});
  }, []);

  const items = [
    { to: '/library', icon: BookOpen, label: 'Read a story', color: 'text-emerald-500' },
    { to: '/vocabulary', icon: Repeat, label: 'Review vocabulary', color: 'text-indigo-500', badge: due },
    { to: '/dictation', icon: Ear, label: 'Dictation practice', color: 'text-blue-500' },
    { to: '/shadowing', icon: Mic, label: 'Shadowing (speak)', color: 'text-pink-500' },
    { to: '/notebook', icon: BookMarked, label: 'Fix your mistakes', color: 'text-red-500', badge: mistakes },
    { to: '/homework', icon: BookMarked, label: 'Homework', color: 'text-amber-500', badge: homework },
    { to: '/weekly-review', icon: CalendarCheck, label: 'Weekly review', color: 'text-teal-500' },
    ...(B1_PLUS.includes(user?.cefr_level) ? [{ to: '/authentic', icon: Globe, label: 'Real-world English', color: 'text-green-600' }] : []),
    { to: '/talk', icon: MessageCircle, label: 'Practice conversation', color: 'text-purple-500' },
  ];

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm p-5 mb-6 border border-gray-100 dark:border-gray-800">
      <p className="font-bold text-gray-900 dark:text-white mb-1">Today&rsquo;s practice</p>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">A little of each skill keeps you moving toward C1.</p>
      <div className="grid sm:grid-cols-2 gap-2">
        {items.map((it) => (
          <Link
            key={it.to}
            to={it.to}
            className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-800 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
          >
            <it.icon className={`w-5 h-5 ${it.color}`} />
            <span className="flex-1 text-sm font-medium text-gray-800 dark:text-gray-200">{it.label}</span>
            {it.badge > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-semibold">{it.badge}</span>
            )}
            <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600" />
          </Link>
        ))}
      </div>
    </div>
  );
}
