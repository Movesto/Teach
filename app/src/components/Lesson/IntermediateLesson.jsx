import { useState } from 'react';
import { CheckCircle, BookOpen, MessageSquare, Volume2, Mic, PenTool, ChevronDown, ChevronUp, Eye, EyeOff, Lightbulb, Target } from 'lucide-react';
import { Quiz } from './Quiz';
import { ListeningExercise } from './index';

const SECTIONS = [
  { id: 'objectives',   label: 'Objectives',        icon: Target,        has: () => true },
  { id: 'reading',      label: 'Reading',            icon: BookOpen,      has: l => l.reading_passage },
  { id: 'comprehension',label: 'Comprehension',      icon: MessageSquare, has: l => l.comprehension },
  { id: 'listening',    label: 'Listening',          icon: Volume2,       has: l => l.listening?.length },
  { id: 'language',     label: 'Language Focus',     icon: Lightbulb,     has: l => l.language_focus },
  { id: 'vocabulary',   label: 'Vocabulary',         icon: BookOpen,      has: l => l.vocabulary_in_context },
  { id: 'speaking',     label: 'Speaking Task',      icon: Mic,           has: l => l.speaking_task },
  { id: 'writing',      label: 'Writing Workshop',   icon: PenTool,       has: l => l.writing_workshop },
  { id: 'quiz',         label: 'Quiz',               icon: CheckCircle,   has: l => l.quiz },
];

const REGISTER_COLORS = {
  formal:   'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300',
  neutral:  'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300',
  informal: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
};

export default function IntermediateLesson({ lesson, onQuizComplete, onRequestHelp }) {
  const [currentSection, setCurrentSection] = useState('objectives');
  const [completed, setCompleted] = useState([]);
  const [revealed, setRevealed] = useState({});
  const [showModel, setShowModel] = useState(false);
  const [writingText, setWritingText] = useState('');
  const [openVocab, setOpenVocab] = useState(null);

  const sections = SECTIONS.filter(s => s.has(lesson));

  // Next available section after `id` — sections vary per lesson.
  const nextAfter = (id) => {
    const i = sections.findIndex(s => s.id === id);
    return sections[i + 1]?.id ?? 'quiz';
  };

  const finish = (section, next) => {
    if (!completed.includes(section)) setCompleted(c => [...c, section]);
    setCurrentSection(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggle = (key) => setRevealed(r => ({ ...r, [key]: !r[key] }));

  const navItem = (s) => {
    const Icon = s.icon;
    const done = completed.includes(s.id);
    const active = currentSection === s.id;
    return (
      <button key={s.id} onClick={() => setCurrentSection(s.id)}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors text-left ${
          active ? 'bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 font-medium'
          : done  ? 'text-green-600 dark:text-green-400 hover:bg-gray-50 dark:hover:bg-gray-800'
          :         'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
        }`}>
        <Icon className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1">{s.label}</span>
        {done && <CheckCircle className="w-3.5 h-3.5 text-green-500" />}
      </button>
    );
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Sidebar */}
      <div className="lg:col-span-1">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm p-4 sticky top-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-bold text-teal-600 dark:text-teal-400 uppercase tracking-wider">Intermediate</span>
          </div>
          <nav className="space-y-1">{sections.map(navItem)}</nav>
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
            <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-teal-500 rounded-full transition-all"
                style={{ width: `${(completed.length / sections.length) * 100}%` }} />
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1.5">{completed.length}/{sections.length} sections</p>
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
                  <span className="w-6 h-6 rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-600 dark:text-teal-400 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                  <span className="text-gray-700 dark:text-gray-300">{obj}</span>
                </li>
              ))}
            </ul>
            <button onClick={() => finish('objectives', 'reading')}
              className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-semibold transition-colors">
              Start Reading →
            </button>
          </div>
        )}

        {/* ── Reading Passage ── */}
        {currentSection === 'reading' && lesson.reading_passage && (
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm p-8">
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="w-4 h-4 text-teal-500" />
              <span className="text-xs font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wide">Reading Passage</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{lesson.reading_passage.title}</h2>
            {lesson.reading_passage.source && (
              <p className="text-xs text-gray-400 dark:text-gray-500 mb-6 italic">{lesson.reading_passage.source}</p>
            )}
            <div className="prose prose-gray dark:prose-invert max-w-none text-base leading-relaxed text-gray-800 dark:text-gray-200 mb-8 whitespace-pre-wrap border-l-4 border-teal-200 dark:border-teal-800 pl-6 py-1">
              {lesson.reading_passage.text}
            </div>
            {lesson.reading_passage.glossary?.length > 0 && (
              <div className="bg-teal-50 dark:bg-teal-900/20 rounded-xl p-4 mb-6">
                <p className="text-xs font-semibold text-teal-700 dark:text-teal-400 mb-2 uppercase tracking-wide">Glossary</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {lesson.reading_passage.glossary.map((g, i) => (
                    <div key={i} className="flex gap-2 text-sm">
                      <span className="font-semibold text-teal-700 dark:text-teal-400">{g.word}:</span>
                      <span className="text-gray-600 dark:text-gray-400">{g.meaning}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <button onClick={() => finish('reading', 'comprehension')}
              className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-semibold transition-colors">
              Check Comprehension →
            </button>
          </div>
        )}

        {/* ── Comprehension ── */}
        {currentSection === 'comprehension' && lesson.comprehension && (
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm p-8">
            <div className="flex items-center gap-2 mb-1">
              <MessageSquare className="w-4 h-4 text-teal-500" />
              <span className="text-xs font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wide">Comprehension</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Check Your Understanding</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">Think about each question, then reveal the answer.</p>
            <div className="space-y-5 mb-8">
              {lesson.comprehension.map((q, i) => (
                <div key={i} className="border-2 border-gray-100 dark:border-gray-800 rounded-xl p-5">
                  <div className="flex items-start gap-3 mb-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0 mt-0.5 ${
                      q.type === 'inference' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300'
                      : q.type === 'vocabulary' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                      : 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300'
                    }`}>{q.type || 'literal'}</span>
                    <p className="font-medium text-gray-900 dark:text-white">{q.question}</p>
                  </div>
                  {revealed[`comp-${i}`] ? (
                    <div className="flex items-start gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <p className="text-green-800 dark:text-green-300 text-sm">{q.answer}</p>
                    </div>
                  ) : (
                    <button onClick={() => toggle(`comp-${i}`)}
                      className="flex items-center gap-2 text-sm text-teal-600 dark:text-teal-400 hover:text-teal-800 dark:hover:text-teal-200 font-medium transition-colors">
                      <Eye className="w-4 h-4" /> Reveal answer
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => finish('comprehension', nextAfter('comprehension'))}
              className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-semibold transition-colors">
              Continue →
            </button>
          </div>
        )}

        {/* ── Listening ── */}
        {currentSection === 'listening' && lesson.listening?.length > 0 && (
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm p-8">
            <ListeningExercise
              exercises={lesson.listening}
              onComplete={() => finish('listening', nextAfter('listening'))}
            />
          </div>
        )}

        {/* ── Language Focus ── */}
        {currentSection === 'language' && lesson.language_focus && (
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm p-8">
            <div className="flex items-center gap-2 mb-1">
              <Lightbulb className="w-4 h-4 text-teal-500" />
              <span className="text-xs font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wide">Language Focus</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{lesson.language_focus.title}</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">{lesson.language_focus.explanation}</p>

            {/* Examples from text */}
            {lesson.language_focus.examples?.length > 0 && (
              <div className="mb-6">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Examples in context:</p>
                <div className="space-y-3">
                  {lesson.language_focus.examples.map((ex, i) => (
                    <div key={i} className="bg-teal-50 dark:bg-teal-900/20 border-l-4 border-teal-400 dark:border-teal-600 rounded-r-xl p-4">
                      <p className="text-gray-900 dark:text-white font-medium mb-1">"{ex.sentence}"</p>
                      {ex.note && <p className="text-xs text-teal-700 dark:text-teal-400 italic">{ex.note}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Practice */}
            {lesson.language_focus.practice?.length > 0 && (
              <div className="mb-8">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Practice — think, then reveal:</p>
                <div className="space-y-3">
                  {lesson.language_focus.practice.map((p, i) => (
                    <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                      <p className="text-gray-800 dark:text-gray-200 mb-2">{p.sentence}</p>
                      {revealed[`lang-${i}`] ? (
                        <p className="text-sm text-green-700 dark:text-green-400 font-medium">→ {p.answer}</p>
                      ) : (
                        <button onClick={() => toggle(`lang-${i}`)}
                          className="text-sm text-teal-600 dark:text-teal-400 hover:text-teal-800 font-medium flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5" /> Show answer
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <button onClick={() => finish('language', 'vocabulary')}
              className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-semibold transition-colors">
              Explore Vocabulary →
            </button>
          </div>
        )}

        {/* ── Vocabulary in Context ── */}
        {currentSection === 'vocabulary' && lesson.vocabulary_in_context && (
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm p-8">
            <div className="flex items-center gap-2 mb-1">
              <BookOpen className="w-4 h-4 text-teal-500" />
              <span className="text-xs font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wide">Vocabulary in Context</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Key Words & Phrases</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-6 text-sm">Click each word to explore how it's used.</p>
            <div className="space-y-3 mb-8">
              {lesson.vocabulary_in_context.map((v, i) => (
                <div key={i} className="border-2 border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
                  <button onClick={() => setOpenVocab(openVocab === i ? null : i)}
                    className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="font-bold text-gray-900 dark:text-white text-lg">{v.word}</span>
                      {v.register && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${REGISTER_COLORS[v.register] || REGISTER_COLORS.neutral}`}>
                          {v.register}
                        </span>
                      )}
                    </div>
                    {openVocab === i ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </button>
                  {openVocab === i && (
                    <div className="px-4 pb-4 space-y-3 border-t border-gray-100 dark:border-gray-800">
                      <p className="text-gray-600 dark:text-gray-400 text-sm pt-3">{v.definition}</p>
                      <div className="bg-teal-50 dark:bg-teal-900/20 rounded-lg p-3">
                        <p className="text-xs font-semibold text-teal-600 dark:text-teal-400 mb-1">In the text:</p>
                        <p className="text-gray-800 dark:text-gray-200 text-sm italic">"{v.example_sentence}"</p>
                      </div>
                      {v.collocations?.length > 0 && (
                        <div>
                          <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">Common collocations:</p>
                          <div className="flex flex-wrap gap-2">
                            {v.collocations.map((c, ci) => (
                              <span key={ci} className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-xs px-2.5 py-1 rounded-full">{c}</span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => finish('vocabulary', 'speaking')}
              className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-semibold transition-colors">
              Speaking Task →
            </button>
          </div>
        )}

        {/* ── Speaking Task ── */}
        {currentSection === 'speaking' && lesson.speaking_task && (
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm p-8">
            <div className="flex items-center gap-2 mb-1">
              <Mic className="w-4 h-4 text-teal-500" />
              <span className="text-xs font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wide">Speaking Task</span>
            </div>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Speak Your Mind</h2>
              {lesson.speaking_task.type && (
                <span className="text-xs bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 px-2.5 py-1 rounded-full font-medium capitalize">
                  {lesson.speaking_task.type}
                </span>
              )}
            </div>
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
                  className="flex items-center gap-2 text-sm font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-800 transition-colors mb-2">
                  {revealed['speaking-phrases'] ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  Useful language
                </button>
                {revealed['speaking-phrases'] && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {lesson.speaking_task.useful_language.map((p, i) => (
                      <div key={i} className="bg-teal-50 dark:bg-teal-900/20 border border-teal-200 dark:border-teal-700 rounded-lg px-3 py-2 text-sm text-teal-800 dark:text-teal-200 font-medium">
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
            <button onClick={() => finish('speaking', 'writing')}
              className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-semibold transition-colors">
              Writing Workshop →
            </button>
          </div>
        )}

        {/* ── Writing Workshop ── */}
        {currentSection === 'writing' && lesson.writing_workshop && (
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm p-8">
            <div className="flex items-center gap-2 mb-1">
              <PenTool className="w-4 h-4 text-teal-500" />
              <span className="text-xs font-semibold text-teal-600 dark:text-teal-400 uppercase tracking-wide">Writing Workshop</span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-5">Writing Workshop</h2>

            {/* Model text */}
            {lesson.writing_workshop.model_text && (
              <div className="mb-6">
                <button onClick={() => setShowModel(!showModel)}
                  className="flex items-center gap-2 text-sm font-semibold text-teal-600 dark:text-teal-400 hover:text-teal-800 transition-colors mb-2">
                  {showModel ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  {showModel ? 'Hide' : 'Read'} the model text
                </button>
                {showModel && (
                  <div className="bg-gray-50 dark:bg-gray-800 border-l-4 border-teal-400 dark:border-teal-600 rounded-r-xl p-5 mb-3 text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {lesson.writing_workshop.model_text}
                  </div>
                )}
                {showModel && lesson.writing_workshop.model_analysis && (
                  <div className="bg-teal-50 dark:bg-teal-900/20 rounded-xl p-4 mb-4">
                    <p className="text-xs font-semibold text-teal-700 dark:text-teal-400 mb-1 uppercase tracking-wide">Why it works:</p>
                    <p className="text-sm text-teal-900 dark:text-teal-200">{lesson.writing_workshop.model_analysis}</p>
                  </div>
                )}
              </div>
            )}

            {/* Task */}
            <div className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700 rounded-xl p-5 mb-5">
              <p className="font-semibold text-indigo-900 dark:text-indigo-200 mb-1">Your task:</p>
              <p className="text-indigo-800 dark:text-indigo-300">{lesson.writing_workshop.task}</p>
              {lesson.writing_workshop.word_count && (
                <p className="text-xs text-indigo-500 dark:text-indigo-400 mt-2">Target: {lesson.writing_workshop.word_count} words</p>
              )}
            </div>

            {/* Success criteria */}
            {lesson.writing_workshop.success_criteria?.length > 0 && (
              <div className="mb-5">
                <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Success criteria:</p>
                <ul className="space-y-1.5">
                  {lesson.writing_workshop.success_criteria.map((c, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <CheckCircle className="w-4 h-4 text-teal-400 flex-shrink-0 mt-0.5" />
                      {c}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <textarea
              value={writingText}
              onChange={e => setWritingText(e.target.value)}
              placeholder="Write your response here..."
              rows={7}
              className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-teal-500 dark:focus:border-teal-400 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 resize-none mb-1"
            />
            <p className="text-xs text-gray-400 dark:text-gray-500 mb-5">
              {writingText.trim().split(/\s+/).filter(Boolean).length} words
            </p>
            <button onClick={() => finish('writing', 'quiz')}
              className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-semibold transition-colors">
              Take the Quiz →
            </button>
          </div>
        )}

        {/* ── Quiz ── */}
        {currentSection === 'quiz' && lesson.quiz && (
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm p-8">
            <Quiz questions={lesson.quiz} lessonId={lesson.id} onComplete={onQuizComplete} onRequestHelp={onRequestHelp} />
          </div>
        )}
      </div>
    </div>
  );
}
