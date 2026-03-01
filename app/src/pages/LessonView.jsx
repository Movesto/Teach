import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { PatternDrill } from '../components/Lesson/PatternDrill';
import { Quiz } from '../components/Lesson/Quiz';
import { StorySection, ListeningExercise, SpeakingRecorder, WritingExercise, GrammarDiscovery } from '../components/Lesson';
import AITutorModal from '../components/AITutorModal';
import { HelpCircle, BookOpen, Volume2, Mic, Edit, CheckCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LessonView() {
  const { lessonId } = useParams();
  const navigate = useNavigate();
  const { token } = useAuth();
  
  const [lesson, setLesson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentSection, setCurrentSection] = useState('objectives');
  const [showTutor, setShowTutor] = useState(false);
  const [tutorContext, setTutorContext] = useState(null);
  const [completedSections, setCompletedSections] = useState([]);

  useEffect(() => {
    fetch(`/api/lessons/${lessonId}`)
      .then(res => res.json())
      .then(data => {
        setLesson(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error loading lesson:', err);
        setLoading(false);
      });
  }, [lessonId]);

  const requestHelp = (content) => {
    setTutorContext(content);
    setShowTutor(true);
  };

  const markSectionComplete = (section) => {
    if (!completedSections.includes(section)) {
      setCompletedSections([...completedSections, section]);
    }
  };

  const sections = [
    { id: 'objectives', label: 'Learning Objectives', icon: CheckCircle },
    { id: 'target', label: 'Target Language', icon: BookOpen },
    { id: 'story', label: 'Situation', icon: BookOpen },
    { id: 'reading', label: 'Reading Practice', icon: BookOpen },
    { id: 'drills', label: 'Pattern Drills', icon: Volume2 },
    { id: 'listening', label: 'Listening', icon: Volume2 },
    { id: 'speaking', label: 'Speaking', icon: Mic },
    { id: 'writing', label: 'Writing', icon: Edit },
    { id: 'grammar', label: 'Grammar Discovery', icon: BookOpen },
    { id: 'quiz', label: 'Quiz', icon: CheckCircle }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!lesson) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Lesson not found</h1>
        <button
          onClick={() => navigate('/home')}
          className="text-blue-600 hover:underline"
        >
          Return to home
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-semibold text-blue-600">
            Unit {lesson.unit_id} • Lesson {lesson.lesson_number}
          </span>
          <button
            onClick={() => requestHelp({ type: 'lesson', content: lesson })}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <HelpCircle className="w-5 h-5" />
            Get Help in Somali
          </button>
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">{lesson.title}</h1>
        <p className="text-gray-600">{lesson.description}</p>
        {lesson.story_context && (
          <div className="mt-4 bg-amber-50 border-l-4 border-amber-500 rounded-r-lg p-4">
            <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Ahmed's Story</p>
            <p className="text-amber-900 text-sm leading-relaxed">{lesson.story_context}</p>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-semibold text-gray-700">Progress</span>
          <span className="text-sm text-gray-600">
            {completedSections.length} / {sections.length} sections
          </span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 transition-all duration-500"
            style={{ width: `${(completedSections.length / sections.length) * 100}%` }}
          ></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Navigation */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm p-4 sticky top-4">
            <h3 className="font-semibold text-gray-900 mb-3">Lesson Sections</h3>
            <nav className="space-y-1">
              {sections.map((section) => {
                const Icon = section.icon;
                const isCompleted = completedSections.includes(section.id);
                const isCurrent = currentSection === section.id;
                
                return (
                  <button
                    key={section.id}
                    onClick={() => setCurrentSection(section.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                      isCurrent
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : isCompleted
                        ? 'text-green-600 hover:bg-gray-50'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {section.label}
                    {isCompleted && (
                      <CheckCircle className="w-4 h-4 ml-auto text-green-600" />
                    )}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-lg shadow-sm p-8">
            {currentSection === 'objectives' && lesson.objectives && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Learning Objectives</h2>
                <p className="text-gray-600 mb-4">By the end of this lesson, you will be able to:</p>
                <ul className="space-y-2 mb-6">
                  {lesson.objectives.map((obj, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                      <span className="text-gray-700">{obj}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => {
                    markSectionComplete('objectives');
                    setCurrentSection('target');
                  }}
                  className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                  Continue to Target Language
                </button>
              </div>
            )}

            {currentSection === 'target' && lesson.target_language && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Target Language</h2>
                <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-6 mb-6">
                  <h3 className="font-semibold text-blue-900 mb-3">Core Phrases You Will Learn:</h3>
                  <ul className="space-y-2">
                    {lesson.target_language.phrases?.map((phrase, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-blue-600 font-bold">{idx + 1}.</span>
                        <span className="text-gray-800 text-lg">"{phrase}"</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                {lesson.target_language.grammar_patterns ? (
                  <div className="mb-6">
                    <h3 className="font-semibold text-gray-900 mb-3">Grammar Patterns:</h3>
                    <div className="grid gap-4 sm:grid-cols-2">
                      {lesson.target_language.grammar_patterns.map((gp, idx) => (
                        <div key={idx} className="bg-gray-50 border-2 border-gray-200 rounded-lg p-5">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{gp.label}</p>
                          <p className="text-lg font-bold text-blue-700 mb-3">{gp.pattern}</p>
                          <ul className="space-y-1">
                            {gp.examples.map((ex, i) => (
                              <li key={i} className="text-gray-700 text-sm flex items-start gap-1">
                                <span className="text-blue-500 mt-0.5">&#8226;</span>
                                {ex}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : lesson.target_language.grammar_pattern ? (
                  <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-6 mb-6">
                    <h3 className="font-semibold text-gray-900 mb-3">Grammar Pattern:</h3>
                    <div className="font-mono text-gray-800 whitespace-pre-line">
                      {lesson.target_language.grammar_pattern}
                    </div>
                  </div>
                ) : null}

                <button
                  onClick={() => {
                    markSectionComplete('target');
                    setCurrentSection('story');
                  }}
                  className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                  Continue to Situation
                </button>
              </div>
            )}

            {currentSection === 'story' && lesson.story && (
              <StorySection
                story={lesson.story}
                onComplete={() => {
                  markSectionComplete('story');
                  setCurrentSection('reading');
                }}
                onRequestHelp={requestHelp}
              />
            )}

            {currentSection === 'reading' && lesson.story && (
              <div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">Reading Practice</h2>
                <p className="text-gray-600 mb-6">Read this dialogue out loud 3 times. Focus on pronunciation.</p>
                <div className="bg-gray-50 border-2 border-gray-200 rounded-lg p-6 mb-6">
                  <div className="prose max-w-none">
                    {lesson.story.dialogue?.map((line, idx) => (
                      <div key={idx} className="mb-4">
                        <p className="font-semibold text-gray-900">{line.speaker}:</p>
                        <p className="text-gray-800 ml-4">{line.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="bg-blue-50 border-l-4 border-blue-600 p-4 mb-6">
                  <p className="text-blue-900">
                    <strong>Now:</strong> Read it again, faster and more naturally.
                  </p>
                </div>
                <button
                  onClick={() => {
                    markSectionComplete('reading');
                    setCurrentSection('drills');
                  }}
                  className="w-full py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                  Continue to Pattern Drills
                </button>
              </div>
            )}

            {currentSection === 'drills' && lesson.drills && (
              <PatternDrill
                drills={lesson.drills}
                onComplete={() => {
                  markSectionComplete('drills');
                  setCurrentSection('listening');
                }}
                onRequestHelp={requestHelp}
              />
            )}

            {currentSection === 'listening' && lesson.listening && (
              <ListeningExercise
                exercises={lesson.listening}
                onComplete={() => {
                  markSectionComplete('listening');
                  setCurrentSection('speaking');
                }}
                onRequestHelp={requestHelp}
              />
            )}

            {currentSection === 'speaking' && lesson.speaking && (
              <SpeakingRecorder
                tasks={lesson.speaking}
                onComplete={() => {
                  markSectionComplete('speaking');
                  setCurrentSection('writing');
                }}
                onRequestHelp={requestHelp}
              />
            )}

            {currentSection === 'writing' && lesson.writing && (
              <WritingExercise
                tasks={lesson.writing}
                storageKey={lessonId}
                onComplete={() => {
                  markSectionComplete('writing');
                  setCurrentSection('grammar');
                }}
                onRequestHelp={requestHelp}
              />
            )}

            {currentSection === 'grammar' && lesson.grammar_discovery && (
              <GrammarDiscovery
                content={lesson.grammar_discovery}
                onComplete={() => {
                  markSectionComplete('grammar');
                  setCurrentSection('quiz');
                }}
                onRequestHelp={requestHelp}
              />
            )}

            {currentSection === 'quiz' && lesson.quiz && (
              <Quiz
                questions={lesson.quiz}
                lessonId={lessonId}
                onComplete={(score) => {
                  markSectionComplete('quiz');
                  const headers = { 'Content-Type': 'application/json' };
                  if (token) headers['Authorization'] = `Bearer ${token}`;
                  fetch('/api/quiz/submit', {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                      lesson_id: lessonId,
                      unit_id: lesson?.unit_id,
                      score: score
                    })
                  }).then(() => {
                    navigate('/home');
                  });
                }}
                onRequestHelp={requestHelp}
              />
            )}
          </div>
        </div>
      </div>

      <AITutorModal
        isOpen={showTutor}
        onClose={() => setShowTutor(false)}
        context={tutorContext}
      />
    </div>
  );
}