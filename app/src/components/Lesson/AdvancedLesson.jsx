import { useState } from 'react';
import { CheckCircle, BookOpen, MessageSquare, PenTool, ChevronDown, ChevronUp, Eye, EyeOff, Zap, AlertCircle, Target, Mic2, FileText, Volume2 } from 'lucide-react';
import { Quiz } from './Quiz';
import { ListeningExercise } from './index';

const SECTIONS = [
  { id: 'objectives',   label: 'Objectives',         icon: Target },
  { id: 'text',         label: 'Authentic Text',      icon: FileText },
  { id: 'critical',     label: 'Critical Reading',    icon: MessageSquare },
  { id: 'listening',    label: 'Listening',           icon: Volume2 },
  { id: 'analysis',     label: 'Language Analysis',   icon: Zap },
  { id: 'errors',       label: 'Error Correction',    icon: AlertCircle },
  { id: 'debate',       label: 'Debate / Argument',   icon: Mic2 },
  { id: 'speaking',     label: 'Speaking Task',       icon: Mic2 },
  { id: 'workshop',     label: 'Writing Workshop',    icon: PenTool },
  { id: 'writing',      label: 'Extended Writing',    icon: PenTool },
  { id: 'grammar',      label: 'Advanced Grammar',    icon: BookOpen },
  { id: 'quiz',         label: 'Assessment',          icon: CheckCircle },
];

const TEXT_TYPE_COLORS = {
  article:        'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  letter:         'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  speech:         'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  report:         'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300',
  editorial:      'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  'formal email': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
};

const Q_TYPE_COLORS = {
  inference:  'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  vocabulary: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  tone:       'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  purpose:    'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  literal:    'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
};

export default function AdvancedLesson({ lesson, onQuizComplete, onRequestHelp }) {
  const [currentSection, setCurrentSection] = useState('objectives');
  const [completed, setCompleted] = useState([]);
  const [revealed, setRevealed] = useState({});
  const [writingText, setWritingText] = useState('');
  const [workshopText, setWorkshopText] = useState('');
  const [correctionShown, setCorrectionShown] = useState({});
  const [notes, setNotes] = useState(() => {
    try { return localStorage.getItem(`notes-${lesson.id}`) || ''; } catch { return ''; }
  });
  const saveNotes = (v) => {
    setNotes(v);
    try { localStorage.setItem(`notes-${lesson.id}`, v); } catch { /* ignore */ }
  };

  const finish = (section, next) => {
    if (!completed.includes(section)) setCompleted(c => [...c, section]);
    setCurrentSection(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggle = key => setRevealed(r => ({ ...r, [key]: !r[key] }));

  // Skip sections that have no content in this lesson
  const availableSections = SECTIONS.filter(s => {
    if (s.id === 'objectives') return true;
    if (s.id === 'quiz') return !!lesson.quiz;
    if (s.id === 'text') return !!lesson.authentic_text;
    if (s.id === 'critical') return !!lesson.critical_reading?.length;
    if (s.id === 'listening') return !!lesson.listening?.length;
    if (s.id === 'analysis') return !!lesson.language_analysis;
    if (s.id === 'errors') return !!lesson.error_correction?.sentences?.length;
    if (s.id === 'debate') return !!lesson.debate_task;
    if (s.id === 'speaking') return !!lesson.speaking_task;
    if (s.id === 'workshop') return !!lesson.writing_workshop;
    if (s.id === 'writing') return !!lesson.extended_writing;
    if (s.id === 'grammar') return !!lesson.advanced_grammar;
    return false;
  });

  const navItem = (s) => {
    const Icon = s.icon;
    const done = completed.includes(s.id);
    const active = currentSection === s.id;
    return (
      <button key={s.id} onClick={() => setCurrentSection(s.id)}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
          active ? 'bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-400 font-medium'
          : done  ? 'text-green-600 dark:text-green-400 hover:bg-gray-50 dark:hover:bg-gray-800'
          :         'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
        }`}>
        <Icon className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1">{s.label}</span>
        {done && <CheckCircle className="w-3.5 h-3.5 text-green-500" />}
      </button>
    );
  };

  const nextSection = (current) => {
    const idx = availableSections.findIndex(s => s.id === current);
    return availableSections[idx + 1]?.id || 'quiz';
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Sidebar */}
      <div className="lg:col-span-1">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm p-4 sticky top-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider">Advanced</span>
          </div>
          <nav className="space-y-1">{availableSections.map(navItem)}</nav>
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
            <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-violet-500 rounded-full transition-all"
                style={{ width: `${(completed.length / availableSections.length) * 100}%` }} />
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">{completed.length}/{availableSections.length} sections</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="lg:col-span-3 space-y-4">

        {/* ── Objectives ── */}
        {currentSection === 'objectives' && (
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm p-8">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Learning Objectives</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-5 text-sm">By the end of this lesson you will be able to:</p>
            <ul className="space-y-3 mb-8">
              {(lesson.objectives || []).map((obj, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                  <span className="text-gray-700 dark:text-gray-300">{obj}</span>
                </li>
              ))}
            </ul>
            <button onClick={() => finish('objectives', nextSection('objectives'))}
              className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-semibold transition-colors">
              Begin →
            </button>
          </div>
        )}

        {/* ── Authentic Text ── */}
        {currentSection === 'text' && lesson.authentic_text && (
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm p-8">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-violet-500" />
              <span className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wide">Authentic Text</span>
              {lesson.authentic_text.type && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${TEXT_TYPE_COLORS[lesson.authentic_text.type] || 'bg-gray-100 text-gray-700'}`}>
                  {lesson.authentic_text.type}
                </span>
              )}
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{lesson.authentic_text.title}</h2>
            {lesson.authentic_text.source && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-6 italic">{lesson.authentic_text.source}</p>
            )}
            <div className="text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap mb-4 text-base border-l-4 border-violet-300 dark:border-violet-700 pl-6 py-1">
              {lesson.authentic_text.text}
            </div>
            {lesson.authentic_text.notes && (
              <div className="bg-violet-50 dark:bg-violet-900/20 rounded-xl p-4 mb-6">
                <p className="text-xs font-semibold text-violet-700 dark:text-violet-400 mb-1 uppercase tracking-wide">Reading note:</p>
                <p className="text-sm text-violet-900 dark:text-violet-200">{lesson.authentic_text.notes}</p>
              </div>
            )}
            <button onClick={() => finish('text', nextSection('text'))}
              className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-semibold transition-colors">
              Critical Reading →
            </button>
          </div>
        )}

        {/* ── Critical Reading ── */}
        {currentSection === 'critical' && lesson.critical_reading && (
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm p-8">
            <div className="flex items-center gap-2 mb-1">
              <MessageSquare className="w-4 h-4 text-violet-500" />
              <span className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wide">Critical Reading</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Analyse the Text</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">
              These questions go beyond recall — consider tone, implication, word choice, and purpose.
            </p>
            <div className="space-y-5 mb-8">
              {lesson.critical_reading.map((q, i) => (
                <div key={i} className="border-2 border-gray-100 dark:border-gray-800 rounded-xl p-5">
                  <div className="flex items-start gap-2 mb-3 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${Q_TYPE_COLORS[q.type] || Q_TYPE_COLORS.literal}`}>
                      {q.type || 'literal'}
                    </span>
                    <p className="font-medium text-gray-900 dark:text-white">{q.question}</p>
                  </div>
                  {revealed[`crit-${i}`] ? (
                    <div className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700 rounded-lg p-3">
                      <p className="text-violet-900 dark:text-violet-200 text-sm leading-relaxed">{q.answer}</p>
                    </div>
                  ) : (
                    <button onClick={() => toggle(`crit-${i}`)}
                      className="flex items-center gap-2 text-sm text-violet-600 dark:text-violet-400 hover:text-violet-800 font-medium transition-colors">
                      <Eye className="w-4 h-4" /> Reveal analysis
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => finish('critical', nextSection('critical'))}
              className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-semibold transition-colors">
              Continue →
            </button>
          </div>
        )}

        {/* ── Listening ── */}
        {currentSection === 'listening' && lesson.listening?.length > 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm p-8">
            {lesson.note_taking && (
              <div className="mb-6 border-2 border-violet-100 dark:border-violet-900/40 rounded-xl p-5 bg-violet-50/50 dark:bg-violet-900/10">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4 text-violet-500" />
                  <span className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wide">Note-taking</span>
                </div>
                <p className="text-gray-700 dark:text-gray-300 mb-3 leading-relaxed">{lesson.note_taking.prompt}</p>
                <textarea
                  value={notes}
                  onChange={e => saveNotes(e.target.value)}
                  placeholder="Take notes here as you listen…"
                  className="w-full p-3 border-2 border-gray-200 dark:border-gray-700 rounded-lg focus:border-violet-500 focus:outline-none min-h-[140px] text-gray-900 dark:text-white bg-white dark:bg-gray-800 placeholder-gray-400 dark:placeholder-gray-500"
                />
                {lesson.note_taking.model_notes?.length > 0 && (
                  <div className="mt-3">
                    <button
                      onClick={() => toggle('note_model')}
                      className="flex items-center gap-1.5 text-sm font-medium text-violet-600 dark:text-violet-400 hover:underline"
                    >
                      {revealed.note_model ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      {revealed.note_model ? 'Hide model notes' : 'Compare with model notes'}
                    </button>
                    {revealed.note_model && (
                      <ul className="mt-2 space-y-1.5 bg-white dark:bg-gray-800 rounded-lg p-4 border border-violet-100 dark:border-violet-900/40">
                        {lesson.note_taking.model_notes.map((m, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                            <span className="text-violet-500 mt-0.5">&#8226;</span>{m}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            )}
            <ListeningExercise
              exercises={lesson.listening}
              onComplete={() => finish('listening', nextSection('listening'))}
            />
          </div>
        )}

        {/* ── Language Analysis ── */}
        {currentSection === 'analysis' && lesson.language_analysis && (
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm p-8">
            <div className="flex items-center gap-2 mb-1">
              <Zap className="w-4 h-4 text-violet-500" />
              <span className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wide">Language Analysis</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{lesson.language_analysis.focus}</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">{lesson.language_analysis.explanation}</p>

            {lesson.language_analysis.examples?.length > 0 && (
              <div className="mb-6">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">From the text:</p>
                <div className="space-y-3">
                  {lesson.language_analysis.examples.map((ex, i) => (
                    <div key={i} className="bg-violet-50 dark:bg-violet-900/20 border-l-4 border-violet-400 dark:border-violet-600 rounded-r-xl p-4">
                      <p className="font-medium text-gray-900 dark:text-white mb-1 italic">"{ex.from_text}"</p>
                      <p className="text-sm text-violet-700 dark:text-violet-300">{ex.analysis}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {lesson.language_analysis.contrast?.length > 0 && (
              <div className="mb-6">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Formal vs. informal:</p>
                <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="text-left px-4 py-2.5 font-semibold text-gray-700 dark:text-gray-300">Formal</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-gray-700 dark:text-gray-300">Informal / Everyday</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                      {lesson.language_analysis.contrast.map((row, i) => (
                        <tr key={i}>
                          <td className="px-4 py-3 text-indigo-700 dark:text-indigo-300 font-medium">{row.formal}</td>
                          <td className="px-4 py-3 text-orange-700 dark:text-orange-300">{row.informal}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <button onClick={() => finish('analysis', nextSection('analysis'))}
              className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-semibold transition-colors">
              Error Correction →
            </button>
          </div>
        )}

        {/* ── Error Correction ── */}
        {currentSection === 'errors' && lesson.error_correction && (
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm p-8">
            <div className="flex items-center gap-2 mb-1">
              <AlertCircle className="w-4 h-4 text-violet-500" />
              <span className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wide">Error Correction</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Find & Fix the Errors</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-2 text-sm">{lesson.error_correction.instruction}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-6">Each sentence has one error. Identify it, then reveal the correction.</p>
            <div className="space-y-4 mb-8">
              {lesson.error_correction.sentences.map((s, i) => (
                <div key={i} className="border-2 border-gray-100 dark:border-gray-800 rounded-xl p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <span className="w-6 h-6 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                    <p className="text-gray-800 dark:text-gray-200 font-medium leading-relaxed">
                      {s.incorrect}
                    </p>
                  </div>
                  {correctionShown[i] ? (
                    <div className="ml-9 space-y-2">
                      <div className="flex items-start gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                        <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                        <p className="text-green-800 dark:text-green-300 text-sm font-medium">{s.correct}</p>
                      </div>
                      {s.explanation && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 italic px-1">{s.explanation}</p>
                      )}
                    </div>
                  ) : (
                    <button onClick={() => setCorrectionShown(c => ({ ...c, [i]: true }))}
                      className="ml-9 flex items-center gap-2 text-sm text-violet-600 dark:text-violet-400 hover:text-violet-800 font-medium transition-colors">
                      <Eye className="w-4 h-4" /> Show correction
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => finish('errors', nextSection('errors'))}
              className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-semibold transition-colors">
              Debate Task →
            </button>
          </div>
        )}

        {/* ── Debate Task ── */}
        {currentSection === 'debate' && lesson.debate_task && (
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm p-8">
            <div className="flex items-center gap-2 mb-1">
              <Mic2 className="w-4 h-4 text-violet-500" />
              <span className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wide">Debate / Argument</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Construct Your Argument</h2>

            {/* Motion */}
            <div className="bg-gray-900 dark:bg-gray-950 text-white rounded-xl p-5 mb-6 text-center">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">Motion</p>
              <p className="text-xl font-bold leading-snug">"{lesson.debate_task.motion}"</p>
            </div>

            {/* Arguments grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {lesson.debate_task.key_arguments?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-green-600 dark:text-green-400 uppercase tracking-wide mb-2">Arguments for</p>
                  <ul className="space-y-2">
                    {lesson.debate_task.key_arguments.map((a, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300 bg-green-50 dark:bg-green-900/10 rounded-lg p-3">
                        <span className="text-green-500 font-bold flex-shrink-0">+</span> {a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {lesson.debate_task.counter_arguments?.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide mb-2">Counter-arguments</p>
                  <ul className="space-y-2">
                    {lesson.debate_task.counter_arguments.map((a, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300 bg-red-50 dark:bg-red-900/10 rounded-lg p-3">
                        <span className="text-red-500 font-bold flex-shrink-0">−</span> {a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Discourse markers */}
            {lesson.debate_task.discourse_markers?.length > 0 && (
              <div className="mb-6">
                <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">Useful discourse markers:</p>
                <div className="flex flex-wrap gap-2">
                  {lesson.debate_task.discourse_markers.map((m, i) => (
                    <span key={i} className="bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-xs px-3 py-1 rounded-full font-medium">
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Task */}
            {lesson.debate_task.task && (
              <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-xl p-4 mb-6">
                <p className="font-semibold text-indigo-900 dark:text-indigo-200 mb-1 text-sm">Your task:</p>
                <p className="text-indigo-800 dark:text-indigo-300 text-sm">{lesson.debate_task.task}</p>
              </div>
            )}

            <button onClick={() => finish('debate', nextSection('debate'))}
              className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-semibold transition-colors">
              Continue →
            </button>
          </div>
        )}

        {/* ── Speaking Task ── */}
        {currentSection === 'speaking' && lesson.speaking_task && (
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm p-8">
            <div className="flex items-center gap-2 mb-1">
              <Mic2 className="w-4 h-4 text-violet-500" />
              <span className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wide">Speaking Task</span>
              {lesson.speaking_task.type && (
                <span className="text-xs bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 px-2.5 py-1 rounded-full font-medium capitalize">
                  {lesson.speaking_task.type}
                </span>
              )}
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Speak Your Mind</h2>
            {lesson.speaking_task.context && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-400 dark:border-amber-600 rounded-r-xl p-4 mb-5">
                <p className="text-amber-900 dark:text-amber-200 text-sm">{lesson.speaking_task.context}</p>
              </div>
            )}
            <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-5 mb-5">
              <p className="font-semibold text-gray-900 dark:text-white mb-1">Your task:</p>
              <p className="text-gray-700 dark:text-gray-300">{lesson.speaking_task.prompt}</p>
            </div>
            {lesson.speaking_task.useful_language?.length > 0 && (
              <div className="mb-5">
                <button onClick={() => toggle('speaking-phrases')}
                  className="flex items-center gap-2 text-sm font-semibold text-violet-600 dark:text-violet-400 hover:text-violet-800 transition-colors mb-2">
                  {revealed['speaking-phrases'] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  Useful language
                </button>
                {revealed['speaking-phrases'] && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {lesson.speaking_task.useful_language.map((p, i) => (
                      <div key={i} className="bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-700 rounded-lg px-3 py-2 text-sm text-violet-800 dark:text-violet-200 font-medium">
                        "{p}"
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {lesson.speaking_task.model_answer && (
              <div className="mb-6">
                <button onClick={() => toggle('speaking-model')}
                  className="flex items-center gap-2 text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 transition-colors mb-2">
                  {revealed['speaking-model'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  {revealed['speaking-model'] ? 'Hide model answer' : 'See a model answer'}
                </button>
                {revealed['speaking-model'] && (
                  <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 text-sm text-gray-700 dark:text-gray-300 italic">
                    "{lesson.speaking_task.model_answer}"
                  </div>
                )}
              </div>
            )}
            <button onClick={() => finish('speaking', nextSection('speaking'))}
              className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-semibold transition-colors">
              Continue →
            </button>
          </div>
        )}

        {/* ── Writing Workshop ── */}
        {currentSection === 'workshop' && lesson.writing_workshop && (
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm p-8">
            <div className="flex items-center gap-2 mb-1">
              <PenTool className="w-4 h-4 text-violet-500" />
              <span className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wide">Writing Workshop</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-5">Writing Workshop</h2>
            {lesson.writing_workshop.model_text && (
              <div className="mb-6">
                <button onClick={() => toggle('workshop-model')}
                  className="flex items-center gap-2 text-sm font-semibold text-violet-600 dark:text-violet-400 hover:text-violet-800 transition-colors mb-2">
                  {revealed['workshop-model'] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  {revealed['workshop-model'] ? 'Hide' : 'Read'} the model text
                </button>
                {revealed['workshop-model'] && (
                  <div className="bg-gray-50 dark:bg-gray-800 border-l-4 border-violet-400 dark:border-violet-600 rounded-r-xl p-5 mb-3 text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {lesson.writing_workshop.model_text}
                  </div>
                )}
                {revealed['workshop-model'] && lesson.writing_workshop.model_analysis && (
                  <div className="bg-violet-50 dark:bg-violet-900/20 rounded-xl p-4 mb-4">
                    <p className="text-xs font-semibold text-violet-700 dark:text-violet-400 mb-1 uppercase tracking-wide">Why it works:</p>
                    <p className="text-sm text-violet-900 dark:text-violet-200">{lesson.writing_workshop.model_analysis}</p>
                  </div>
                )}
              </div>
            )}
            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-xl p-5 mb-5">
              <p className="font-semibold text-indigo-900 dark:text-indigo-200 mb-1">Your task:</p>
              <p className="text-indigo-800 dark:text-indigo-300">{lesson.writing_workshop.task}</p>
              {lesson.writing_workshop.word_count && (
                <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-2">Target: {lesson.writing_workshop.word_count} words</p>
              )}
            </div>
            {lesson.writing_workshop.success_criteria?.length > 0 && (
              <div className="mb-5">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Success criteria:</p>
                <ul className="space-y-1.5">
                  {lesson.writing_workshop.success_criteria.map((c, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <CheckCircle className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <textarea
              value={workshopText}
              onChange={e => setWorkshopText(e.target.value)}
              placeholder="Write your response here..."
              rows={7}
              className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-violet-500 dark:focus:border-violet-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 resize-none mb-1"
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-5">
              {workshopText.trim().split(/\s+/).filter(Boolean).length} words
            </p>
            <button onClick={() => finish('workshop', nextSection('workshop'))}
              className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-semibold transition-colors">
              Continue →
            </button>
          </div>
        )}

        {/* ── Extended Writing ── */}
        {currentSection === 'writing' && lesson.extended_writing && (
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm p-8">
            <div className="flex items-center gap-2 mb-1">
              <PenTool className="w-4 h-4 text-violet-500" />
              <span className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wide">Extended Writing</span>
              {lesson.extended_writing.type && (
                <span className="text-xs bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 px-2 py-0.5 rounded-full font-medium capitalize">
                  {lesson.extended_writing.type.replace('_', ' ')}
                </span>
              )}
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-5">Extended Writing Task</h2>

            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-xl p-5 mb-5">
              <p className="font-semibold text-indigo-900 dark:text-indigo-200 mb-1">Task:</p>
              <p className="text-indigo-800 dark:text-indigo-300">{lesson.extended_writing.task}</p>
              {lesson.extended_writing.word_count && (
                <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-2">Word count: {lesson.extended_writing.word_count}</p>
              )}
            </div>

            {/* Structure guide */}
            {lesson.extended_writing.structure?.length > 0 && (
              <div className="mb-6">
                <button onClick={() => toggle('writing-structure')}
                  className="flex items-center gap-2 text-sm font-semibold text-violet-600 dark:text-violet-400 hover:text-violet-800 transition-colors mb-2">
                  {revealed['writing-structure'] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  Structure guide
                </button>
                {revealed['writing-structure'] && (
                  <div className="space-y-2">
                    {lesson.extended_writing.structure.map((s, i) => (
                      <div key={i} className="flex gap-3 bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                        <span className="w-6 h-6 rounded-full bg-violet-500 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{s.section}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{s.guidance}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <textarea
              value={writingText}
              onChange={e => setWritingText(e.target.value)}
              placeholder="Write your response here..."
              rows={9}
              className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-violet-500 dark:focus:border-violet-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 resize-none mb-1"
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-4">
              {writingText.trim().split(/\s+/).filter(Boolean).length} words
            </p>

            {lesson.extended_writing.model_answer && (
              <div className="mb-6">
                <button onClick={() => toggle('writing-model')}
                  className="flex items-center gap-2 text-sm font-semibold text-gray-500 dark:text-gray-400 hover:text-gray-700 transition-colors mb-2">
                  {revealed['writing-model'] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  {revealed['writing-model'] ? 'Hide model answer' : 'See a model answer'}
                </button>
                {revealed['writing-model'] && (
                  <div className="bg-gray-50 dark:bg-gray-800 border-l-4 border-violet-400 dark:border-violet-600 rounded-r-xl p-5 text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {lesson.extended_writing.model_answer}
                  </div>
                )}
              </div>
            )}

            <button onClick={() => finish('writing', nextSection('writing'))}
              className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-semibold transition-colors">
              Advanced Grammar →
            </button>
          </div>
        )}

        {/* ── Advanced Grammar ── */}
        {currentSection === 'grammar' && lesson.advanced_grammar && (
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm p-8">
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="w-4 h-4 text-violet-500" />
              <span className="text-xs font-semibold text-violet-600 dark:text-violet-400 uppercase tracking-wide">Advanced Grammar</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{lesson.advanced_grammar.structure}</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">{lesson.advanced_grammar.explanation}</p>

            {lesson.advanced_grammar.authentic_examples?.length > 0 && (
              <div className="mb-6">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Authentic examples:</p>
                <div className="space-y-2">
                  {lesson.advanced_grammar.authentic_examples.map((ex, i) => (
                    <div key={i} className="bg-violet-50 dark:bg-violet-900/20 border-l-4 border-violet-400 dark:border-violet-600 rounded-r-xl px-4 py-3">
                      <p className="text-gray-800 dark:text-gray-200 italic">"{ex}"</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {lesson.advanced_grammar.practice?.length > 0 && (
              <div className="mb-8">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Transformation practice:</p>
                <div className="space-y-4">
                  {lesson.advanced_grammar.practice.map((p, i) => (
                    <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                      <p className="text-gray-700 dark:text-gray-300 mb-1 text-sm">{p.sentence}</p>
                      {p.transform && <p className="text-xs text-gray-400 dark:text-gray-500 mb-2 italic">{p.transform}</p>}
                      {revealed[`gram-${i}`] ? (
                        <p className="text-sm text-green-700 dark:text-green-400 font-medium">→ {p.answer}</p>
                      ) : (
                        <button onClick={() => toggle(`gram-${i}`)}
                          className="text-sm text-violet-600 dark:text-violet-400 hover:text-violet-800 font-medium flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5" /> Show answer
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <button onClick={() => finish('grammar', 'quiz')}
              className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white rounded-xl font-semibold transition-colors">
              Take Assessment →
            </button>
          </div>
        )}

        {/* ── Quiz / Assessment ── */}
        {currentSection === 'quiz' && lesson.quiz && (
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm p-8">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xs font-bold text-violet-600 dark:text-violet-400 uppercase tracking-wider">Assessment</span>
            </div>
            <Quiz questions={lesson.quiz} lessonId={lesson.id} onComplete={onQuizComplete} onRequestHelp={onRequestHelp} />
          </div>
        )}
      </div>
    </div>
  );
}
