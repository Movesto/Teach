import React, { useState, useEffect, useRef } from 'react';
import { Mic, Square, Play, CheckCircle, AlertCircle, ArrowRight, ArrowLeft } from 'lucide-react';

function PlacementTest() {
  const [testData, setTestData] = useState(null);
  const [currentSection, setCurrentSection] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlobs, setAudioBlobs] = useState({});
  const [result, setResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startTime] = useState(Date.now());

  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);

  // Load placement test
  useEffect(() => {
    fetch('http://localhost:8000/api/placement/test')
      .then(res => res.json())
      .then(data => {
        setTestData(data);
      })
      .catch(err => console.error('Error loading placement test:', err));
  }, []);

  if (!testData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading placement test...</p>
        </div>
      </div>
    );
  }

  const sections = testData.sections;
  const section = sections[currentSection];

  // Handle answer selection
  const handleAnswer = (questionId, optionIndex) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: {
        question_id: questionId,
        selected_option: optionIndex
      }
    }));
  };

  // Recording functions for speaking section
  const startRecording = async (promptId) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];

      mediaRecorder.current.ondataavailable = (event) => {
        audioChunks.current.push(event.data);
      };

      mediaRecorder.current.onstop = () => {
        const blob = new Blob(audioChunks.current, { type: 'audio/wav' });
        setAudioBlobs(prev => ({ ...prev, [promptId]: blob }));
        
        // Save answer with audio
        setAnswers(prev => ({
          ...prev,
          [promptId]: {
            question_id: promptId,
            audio_url: `audio_${promptId}` // Will upload later
          }
        }));
        
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.current.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Please allow microphone access');
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      setIsRecording(false);
    }
  };

  const playRecording = (promptId) => {
    if (audioBlobs[promptId]) {
      const audio = new Audio(URL.createObjectURL(audioBlobs[promptId]));
      audio.play();
    }
  };

  // Navigation
  const handleNext = () => {
    if (section.id === 'reading' && currentQuestion < section.passages.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    } else if (currentSection < sections.length - 1) {
      setCurrentSection(prev => prev + 1);
      setCurrentQuestion(0);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
    } else if (currentSection > 0) {
      setCurrentSection(prev => prev - 1);
      setCurrentQuestion(0);
    }
  };

  // Submit test
  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    const timeTaken = Math.round((Date.now() - startTime) / 60000); // minutes
    
    const submission = {
      answers: Object.values(answers),
      time_taken_minutes: timeTaken
    };

    try {
      const response = await fetch('http://localhost:8000/api/placement/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submission)
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      console.error('Error submitting test:', error);
      alert('Error submitting test. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render result screen
  if (result) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-8">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-3xl font-bold mb-2">Test Complete!</h1>
            <p className="text-gray-600">Here are your results</p>
          </div>

          {/* Overall Score */}
          <div className="bg-blue-50 rounded-lg p-6 mb-6">
            <div className="text-center">
              <div className="text-6xl font-bold text-blue-600 mb-2">
                {result.percentage}%
              </div>
              <div className="text-xl text-gray-700 mb-1">{result.level.toUpperCase()}</div>
              <div className="text-sm text-gray-600">CEFR Level: {result.cefr}</div>
            </div>
          </div>

          {/* Description */}
          <div className="mb-6">
            <p className="text-lg text-gray-700 mb-4">{result.description}</p>
            <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded">
              <p className="text-green-800">{result.message}</p>
            </div>
          </div>

          {/* Recommended Start */}
          <div className="bg-purple-50 rounded-lg p-6 mb-6">
            <h3 className="font-bold text-lg mb-2">📚 Recommended Starting Point</h3>
            <p className="text-gray-700">
              <span className="font-semibold">Unit {result.recommended_unit}:</span> {result.unit_name}
            </p>
          </div>

          {/* Score Breakdown */}
          <div className="mb-6">
            <h3 className="font-bold text-lg mb-4">📊 Score Breakdown</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(result.breakdown).map(([section, data]) => (
                <div key={section} className="border rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold capitalize">{section}</span>
                    <span className="text-sm text-gray-600">
                      {data.score}/{data.max} points
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full"
                      style={{ width: `${(data.score / data.max) * 100}%` }}
                    ></div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {data.questions_answered}/{data.questions_total} questions answered
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-4 justify-center">
            <button
              onClick={() => window.location.href = `/unit/${result.recommended_unit}`}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-semibold"
            >
              Start Learning →
            </button>
            {result.certificate_available && (
              <button
                className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 font-semibold"
              >
                Download Certificate
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Render test sections
  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h1 className="text-2xl font-bold mb-2">{testData.title}</h1>
        <p className="text-gray-600 mb-4">{testData.description}</p>
        
        {/* Progress */}
        <div className="flex items-center gap-2 mb-2">
          <div className="flex-1 bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-500 h-2 rounded-full transition-all"
              style={{ width: `${((currentSection + 1) / sections.length) * 100}%` }}
            ></div>
          </div>
          <span className="text-sm text-gray-600">
            Section {currentSection + 1} of {sections.length}
          </span>
        </div>
      </div>

      {/* Section Content */}
      <div className="bg-white rounded-lg shadow p-8">
        <h2 className="text-xl font-bold mb-2">{section.title}</h2>
        <p className="text-gray-600 mb-6">{section.description}</p>

        {/* Grammar & Listening Sections */}
        {(section.id === 'grammar' || section.id === 'listening') && (
          <div className="space-y-6">
            {section.questions.map((question, idx) => (
              <div key={question.id} className="border rounded-lg p-6">
                <div className="mb-4">
                  <span className="text-sm text-gray-500">Question {idx + 1} of {section.questions.length}</span>
                  <h3 className="text-lg font-semibold mt-2">{question.question}</h3>
                </div>

                {/* Audio for listening */}
                {question.audio && (
                  <div className="mb-4">
                    <audio controls src={question.audio} className="w-full" />
                  </div>
                )}

                {/* Options */}
                <div className="space-y-2">
                  {question.options.map((option, optIdx) => (
                    <label
                      key={optIdx}
                      className={`flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                        answers[question.id]?.selected_option === optIdx ? 'bg-blue-50 border-blue-500' : ''
                      }`}
                    >
                      <input
                        type="radio"
                        name={question.id}
                        checked={answers[question.id]?.selected_option === optIdx}
                        onChange={() => handleAnswer(question.id, optIdx)}
                        className="mr-3"
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Reading Section */}
        {section.id === 'reading' && (
          <div>
            {section.passages.map((passage, passageIdx) => (
              passageIdx === currentQuestion && (
                <div key={passage.id}>
                  <div className="bg-gray-50 rounded-lg p-6 mb-6">
                    <h3 className="text-lg font-bold mb-4">{passage.title}</h3>
                    <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">{passage.text}</p>
                  </div>

                  <div className="space-y-6">
                    {passage.questions.map((question, qIdx) => (
                      <div key={question.id} className="border rounded-lg p-6">
                        <div className="mb-4">
                          <span className="text-sm text-gray-500">Question {qIdx + 1} of {passage.questions.length}</span>
                          <h4 className="text-lg font-semibold mt-2">{question.question}</h4>
                        </div>

                        <div className="space-y-2">
                          {question.options.map((option, optIdx) => (
                            <label
                              key={optIdx}
                              className={`flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                                answers[question.id]?.selected_option === optIdx ? 'bg-blue-50 border-blue-500' : ''
                              }`}
                            >
                              <input
                                type="radio"
                                name={question.id}
                                checked={answers[question.id]?.selected_option === optIdx}
                                onChange={() => handleAnswer(question.id, optIdx)}
                                className="mr-3"
                              />
                              <span>{option}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            ))}
          </div>
        )}

        {/* Speaking Section */}
        {section.id === 'speaking' && (
          <div className="space-y-8">
            {section.prompts.map((prompt, idx) => (
              <div key={prompt.id} className="border rounded-lg p-6">
                <div className="mb-4">
                  <span className="text-sm text-gray-500">Prompt {idx + 1} of {section.prompts.length}</span>
                  <h3 className="text-lg font-semibold mt-2">{prompt.prompt}</h3>
                  <p className="text-sm text-gray-600 mt-2">
                    <strong>Example:</strong> {prompt.example}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Record {prompt.min_seconds}-{prompt.max_seconds} seconds
                  </p>
                </div>

                <div className="flex gap-3">
                  {!audioBlobs[prompt.id] ? (
                    <>
                      {!isRecording ? (
                        <button
                          onClick={() => startRecording(prompt.id)}
                          className="flex items-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                        >
                          <Mic size={20} />
                          Start Recording
                        </button>
                      ) : (
                        <button
                          onClick={stopRecording}
                          className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800"
                        >
                          <Square size={20} />
                          Stop Recording
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => playRecording(prompt.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                      >
                        <Play size={20} />
                        Play Back
                      </button>
                      <button
                        onClick={() => {
                          setAudioBlobs(prev => {
                            const newBlobs = { ...prev };
                            delete newBlobs[prompt.id];
                            return newBlobs;
                          });
                          setAnswers(prev => {
                            const newAnswers = { ...prev };
                            delete newAnswers[prompt.id];
                            return newAnswers;
                          });
                        }}
                        className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                      >
                        Re-record
                      </button>
                      <CheckCircle className="text-green-500" size={24} />
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-8">
          <button
            onClick={handlePrevious}
            disabled={currentSection === 0 && currentQuestion === 0}
            className="flex items-center gap-2 px-6 py-2 border rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ArrowLeft size={20} />
            Previous
          </button>

          {currentSection === sections.length - 1 ? (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Test'}
            </button>
          ) : (
            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              Next
              <ArrowRight size={20} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default PlacementTest;
