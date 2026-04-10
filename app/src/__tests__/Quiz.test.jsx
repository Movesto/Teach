import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Quiz } from '../components/Lesson/Quiz';

const QUESTIONS = [
  {
    type: 'multiple-choice',
    question: 'What is the capital of England?',
    options: ['Paris', 'London', 'Berlin', 'Rome'],
    correct: 1,  // London
    explanation: 'London is the capital of England.',
  },
  {
    type: 'multiple-choice',
    question: 'Which word means happy?',
    options: ['Sad', 'Angry', 'Joyful', 'Tired'],
    correct: 2,  // Joyful
    explanation: 'Joyful means happy.',
  },
];

const onRequestHelp = vi.fn();

describe('Quiz component', () => {
  it('renders the first question text', () => {
    render(<Quiz questions={QUESTIONS} onComplete={vi.fn()} onRequestHelp={onRequestHelp} />);
    expect(screen.getByText('What is the capital of England?')).toBeInTheDocument();
  });

  it('renders all answer options for the first question', () => {
    render(<Quiz questions={QUESTIONS} onComplete={vi.fn()} onRequestHelp={onRequestHelp} />);
    ['Paris', 'London', 'Berlin', 'Rome'].forEach(opt =>
      expect(screen.getByText(opt)).toBeInTheDocument()
    );
  });

  it('shows the explanation after selecting an answer', () => {
    render(<Quiz questions={QUESTIONS} onComplete={vi.fn()} onRequestHelp={onRequestHelp} />);
    fireEvent.click(screen.getByText('London'));
    expect(screen.getByText(/London is the capital of England/i)).toBeInTheDocument();
  });

  it('reveals a Next Question button after answering', () => {
    render(<Quiz questions={QUESTIONS} onComplete={vi.fn()} onRequestHelp={onRequestHelp} />);
    fireEvent.click(screen.getByText('Paris'));
    expect(screen.getByRole('button', { name: /next question/i })).toBeInTheDocument();
  });

  it('disables answer options once feedback is shown', () => {
    render(<Quiz questions={QUESTIONS} onComplete={vi.fn()} onRequestHelp={onRequestHelp} />);
    fireEvent.click(screen.getByText('London'));
    // All option buttons should be disabled after selecting
    ['Paris', 'London', 'Berlin', 'Rome'].forEach(opt => {
      expect(screen.getByText(opt).closest('button')).toBeDisabled();
    });
  });

  it('advances to the second question when Next is clicked', () => {
    render(<Quiz questions={QUESTIONS} onComplete={vi.fn()} onRequestHelp={onRequestHelp} />);
    fireEvent.click(screen.getByText('London'));
    fireEvent.click(screen.getByRole('button', { name: /next question/i }));
    expect(screen.getByText('Which word means happy?')).toBeInTheDocument();
  });

  it('shows "Complete Quiz" button on the last question', () => {
    render(<Quiz questions={QUESTIONS} onComplete={vi.fn()} onRequestHelp={onRequestHelp} />);
    // Answer Q1 and advance
    fireEvent.click(screen.getByText('London'));
    fireEvent.click(screen.getByRole('button', { name: /next question/i }));
    // Answer Q2 — should see "Complete Quiz"
    fireEvent.click(screen.getByText('Joyful'));
    expect(screen.getByRole('button', { name: /complete quiz/i })).toBeInTheDocument();
  });

  it('shows Quiz Complete screen and calls onComplete with a score', () => {
    const onComplete = vi.fn();
    render(<Quiz questions={QUESTIONS} onComplete={onComplete} onRequestHelp={onRequestHelp} />);
    // Answer both questions and finish
    fireEvent.click(screen.getByText('London'));
    fireEvent.click(screen.getByRole('button', { name: /next question/i }));
    fireEvent.click(screen.getByText('Joyful'));
    fireEvent.click(screen.getByRole('button', { name: /complete quiz/i }));
    // Quiz Complete screen
    expect(screen.getByText('Quiz Complete!')).toBeInTheDocument();
    // Click "Continue to Next Lesson" which calls onComplete(score)
    fireEvent.click(screen.getByRole('button', { name: /continue to next lesson/i }));
    expect(onComplete).toHaveBeenCalledOnce();
    const score = onComplete.mock.calls[0][0];
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  it('scores 100% when all answers are correct', () => {
    const onComplete = vi.fn();
    render(<Quiz questions={QUESTIONS} onComplete={onComplete} onRequestHelp={onRequestHelp} />);
    fireEvent.click(screen.getByText('London'));         // correct
    fireEvent.click(screen.getByRole('button', { name: /next question/i }));
    fireEvent.click(screen.getByText('Joyful'));          // correct
    fireEvent.click(screen.getByRole('button', { name: /complete quiz/i }));
    fireEvent.click(screen.getByRole('button', { name: /continue to next lesson/i }));
    expect(onComplete).toHaveBeenCalledWith(100);
  });
});
