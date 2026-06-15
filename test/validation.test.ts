import { describe, it, expect } from 'vitest';
import { validateQuizInput, type QuizInput } from '../src/lib/validation';

function baseMcQuestion() {
  return {
    type: 'multiple_choice' as const,
    text: 'What is 2 + 2?',
    timeLimitS: 20,
    points: 1000,
    options: [
      { text: '4', isCorrect: true },
      { text: '5', isCorrect: false },
    ],
  };
}

function validQuiz(): QuizInput {
  return { title: 'Math', description: '', questions: [baseMcQuestion()] };
}

describe('validateQuizInput', () => {
  it('accepts a well-formed quiz', () => {
    expect(validateQuizInput(validQuiz())).toEqual([]);
  });

  it('requires a non-empty, bounded title', () => {
    expect(validateQuizInput({ ...validQuiz(), title: '' }).some((e) => e.field === 'title')).toBe(true);
    expect(
      validateQuizInput({ ...validQuiz(), title: 'x'.repeat(101) }).some((e) => e.field === 'title'),
    ).toBe(true);
  });

  it('requires exactly one correct option', () => {
    const q = baseMcQuestion();
    q.options = [
      { text: '4', isCorrect: true },
      { text: '5', isCorrect: true },
    ];
    const errs = validateQuizInput({ ...validQuiz(), questions: [q] });
    expect(errs.some((e) => e.field === 'questions[0].options')).toBe(true);
  });

  it('requires 2-4 options for multiple choice', () => {
    const q = baseMcQuestion();
    q.options = [{ text: 'only', isCorrect: true }];
    const errs = validateQuizInput({ ...validQuiz(), questions: [q] });
    expect(errs.some((e) => e.field === 'questions[0].options')).toBe(true);
  });

  it('requires exactly 2 options for true/false', () => {
    const q = {
      type: 'true_false' as const,
      text: 'The sky is blue.',
      timeLimitS: 20,
      points: 1000,
      options: [
        { text: 'True', isCorrect: true },
        { text: 'False', isCorrect: false },
        { text: 'Maybe', isCorrect: false },
      ],
    };
    const errs = validateQuizInput({ ...validQuiz(), questions: [q] });
    expect(errs.some((e) => e.field === 'questions[0].options')).toBe(true);
  });

  it('enforces the time-limit range', () => {
    const q = baseMcQuestion();
    q.timeLimitS = 3;
    expect(
      validateQuizInput({ ...validQuiz(), questions: [q] }).some(
        (e) => e.field === 'questions[0].timeLimitS',
      ),
    ).toBe(true);
  });

  it('rejects more than 50 questions', () => {
    const questions = Array.from({ length: 51 }, baseMcQuestion);
    expect(
      validateQuizInput({ ...validQuiz(), questions }).some((e) => e.field === 'questions'),
    ).toBe(true);
  });

  it('bounds question and option text length', () => {
    const q = baseMcQuestion();
    q.text = 'x'.repeat(301);
    q.options[0].text = 'y'.repeat(101);
    const errs = validateQuizInput({ ...validQuiz(), questions: [q] });
    expect(errs.some((e) => e.field === 'questions[0].text')).toBe(true);
    expect(errs.some((e) => e.field === 'questions[0].options[0].text')).toBe(true);
  });
});
