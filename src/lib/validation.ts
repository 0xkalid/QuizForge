// Server-side validation for quiz create/update (spec §5).
// Returns field-level errors so the API can respond 400 with messages.

import type { FieldError, QuestionType } from './types';

export const LIMITS = {
  titleMin: 1,
  titleMax: 100,
  descMax: 500,
  questionTextMin: 1,
  questionTextMax: 300,
  optionTextMin: 1,
  optionTextMax: 100,
  maxQuestions: 50,
  timeLimitMin: 5,
  timeLimitMax: 120,
} as const;

// Shape of the payload accepted by PUT /api/quizzes/:id
export interface QuizInputOption {
  text: string;
  isCorrect: boolean;
}

export interface QuizInputQuestion {
  type: QuestionType;
  text: string;
  timeLimitS: number;
  points: number;
  options: QuizInputOption[];
}

export interface QuizInput {
  title: string;
  description?: string;
  questions: QuizInputQuestion[];
}

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

export function validateTitle(title: unknown, errors: FieldError[], field = 'title'): void {
  if (!isString(title) || title.trim().length < LIMITS.titleMin) {
    errors.push({ field, message: 'Title is required.' });
  } else if (title.length > LIMITS.titleMax) {
    errors.push({ field, message: `Title must be at most ${LIMITS.titleMax} characters.` });
  }
}

/** Full validation for a quiz update (title + questions). */
export function validateQuizInput(input: unknown): FieldError[] {
  const errors: FieldError[] = [];
  if (typeof input !== 'object' || input === null) {
    return [{ field: 'body', message: 'Invalid request body.' }];
  }
  const data = input as Record<string, unknown>;

  validateTitle(data.title, errors);

  if (data.description !== undefined) {
    if (!isString(data.description)) {
      errors.push({ field: 'description', message: 'Description must be text.' });
    } else if (data.description.length > LIMITS.descMax) {
      errors.push({
        field: 'description',
        message: `Description must be at most ${LIMITS.descMax} characters.`,
      });
    }
  }

  const questions = data.questions;
  if (!Array.isArray(questions)) {
    errors.push({ field: 'questions', message: 'Questions must be an array.' });
    return errors;
  }
  if (questions.length > LIMITS.maxQuestions) {
    errors.push({
      field: 'questions',
      message: `A quiz may have at most ${LIMITS.maxQuestions} questions.`,
    });
  }

  questions.forEach((q, i) => validateQuestion(q, i, errors));

  return errors;
}

function validateQuestion(q: unknown, index: number, errors: FieldError[]): void {
  const prefix = `questions[${index}]`;
  if (typeof q !== 'object' || q === null) {
    errors.push({ field: prefix, message: 'Invalid question.' });
    return;
  }
  const data = q as Record<string, unknown>;

  const type = data.type;
  if (type !== 'multiple_choice' && type !== 'true_false') {
    errors.push({ field: `${prefix}.type`, message: 'Unknown question type.' });
  }

  if (!isString(data.text) || data.text.trim().length < LIMITS.questionTextMin) {
    errors.push({ field: `${prefix}.text`, message: 'Question text is required.' });
  } else if (data.text.length > LIMITS.questionTextMax) {
    errors.push({
      field: `${prefix}.text`,
      message: `Question text must be at most ${LIMITS.questionTextMax} characters.`,
    });
  }

  const t = data.timeLimitS;
  if (
    typeof t !== 'number' ||
    !Number.isInteger(t) ||
    t < LIMITS.timeLimitMin ||
    t > LIMITS.timeLimitMax
  ) {
    errors.push({
      field: `${prefix}.timeLimitS`,
      message: `Time limit must be between ${LIMITS.timeLimitMin} and ${LIMITS.timeLimitMax} seconds.`,
    });
  }

  if (typeof data.points !== 'number' || data.points <= 0) {
    errors.push({ field: `${prefix}.points`, message: 'Points must be a positive number.' });
  }

  const options = data.options;
  if (!Array.isArray(options)) {
    errors.push({ field: `${prefix}.options`, message: 'Options must be an array.' });
    return;
  }

  const correctCount = options.filter(
    (o) => typeof o === 'object' && o !== null && (o as Record<string, unknown>).isCorrect === true,
  ).length;

  if (type === 'true_false') {
    if (options.length !== 2) {
      errors.push({
        field: `${prefix}.options`,
        message: 'True/false questions must have exactly 2 options.',
      });
    }
  } else if (type === 'multiple_choice') {
    if (options.length < 2 || options.length > 4) {
      errors.push({
        field: `${prefix}.options`,
        message: 'Multiple-choice questions must have 2 to 4 options.',
      });
    }
  }

  if (correctCount !== 1) {
    errors.push({
      field: `${prefix}.options`,
      message: 'Exactly one option must be marked correct.',
    });
  }

  options.forEach((o, j) => {
    const op = o as Record<string, unknown>;
    if (!isString(op?.text) || op.text.trim().length < LIMITS.optionTextMin) {
      errors.push({ field: `${prefix}.options[${j}].text`, message: 'Option text is required.' });
    } else if (op.text.length > LIMITS.optionTextMax) {
      errors.push({
        field: `${prefix}.options[${j}].text`,
        message: `Option text must be at most ${LIMITS.optionTextMax} characters.`,
      });
    }
  });
}
