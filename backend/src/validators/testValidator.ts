import { VALID_EXAMS, VALID_DIFFICULTY, VALID_CBSE_CLASS, VALID_TEST_MODES } from '../constants';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;

export function validateGenerateBody(body: Record<string, unknown>): ValidationResult {
  const { exam, subjects, chapters, difficulty, questionCount, cbseClass, mode } = body;

  if (typeof exam !== 'string' || !VALID_EXAMS.has(exam)) {
    return {
      valid: false,
      error: `Invalid or missing "exam". Must be one of: ${[...VALID_EXAMS].join(', ')}.`,
    };
  }

  if (
    !Array.isArray(subjects) ||
    subjects.length === 0 ||
    subjects.some((s) => typeof s !== 'string')
  ) {
    return { valid: false, error: '"subjects" must be a non-empty array of strings.' };
  }

  if (
    chapters !== undefined &&
    (!Array.isArray(chapters) || chapters.some((c) => typeof c !== 'string'))
  ) {
    return { valid: false, error: '"chapters" must be an array of strings when provided.' };
  }

  if (difficulty !== undefined && !VALID_DIFFICULTY.has(difficulty as string)) {
    return {
      valid: false,
      error: `"difficulty" must be one of: ${[...VALID_DIFFICULTY].join(', ')}.`,
    };
  }

  if (
    questionCount !== undefined &&
    (typeof questionCount !== 'number' || questionCount < 1 || !Number.isInteger(questionCount))
  ) {
    return { valid: false, error: '"questionCount" must be a positive integer when provided.' };
  }

  if (
    cbseClass !== undefined &&
    (typeof cbseClass !== 'string' || !VALID_CBSE_CLASS.has(cbseClass))
  ) {
    return { valid: false, error: '"cbseClass" must be "11", "12", or "both" (CBSE only).' };
  }

  if (mode !== undefined && !VALID_TEST_MODES.has(mode as string)) {
    return {
      valid: false,
      error: `"mode" must be one of: ${[...VALID_TEST_MODES].join(', ')}.`,
    };
  }

  return { valid: true };
}

export function validateSyllabusQuery(query: Record<string, unknown>): ValidationResult {
  const { exam, cbseClass } = query;

  if (typeof exam !== 'string' || !VALID_EXAMS.has(exam)) {
    return {
      valid: false,
      error: `Invalid or missing "exam" query param. Must be one of: ${[...VALID_EXAMS].join(', ')}.`,
    };
  }

  if (
    cbseClass !== undefined &&
    (typeof cbseClass !== 'string' || !VALID_CBSE_CLASS.has(cbseClass))
  ) {
    return { valid: false, error: '"cbseClass" must be "11", "12", or "both" (CBSE only).' };
  }

  return { valid: true };
}

export function validateSubmitBody(body: Record<string, unknown>): ValidationResult {
  const { testId, timeTaken, answers } = body;

  if (typeof testId !== 'string' || !OBJECT_ID_RE.test(testId)) {
    return { valid: false, error: '"testId" must be a valid test ID.' };
  }

  if (
    typeof timeTaken !== 'number' ||
    timeTaken < 0 ||
    !Number.isFinite(timeTaken)
  ) {
    return { valid: false, error: '"timeTaken" must be a non-negative number (seconds).' };
  }

  if (!Array.isArray(answers)) {
    return { valid: false, error: '"answers" must be an array.' };
  }

  for (const [i, ans] of answers.entries()) {
    if (typeof ans !== 'object' || ans === null) {
      return { valid: false, error: `answers[${i}] must be an object.` };
    }
    const a = ans as Record<string, unknown>;

    if (typeof a.questionId !== 'string' || !a.questionId) {
      return { valid: false, error: `answers[${i}].questionId must be a non-empty string.` };
    }
    if (
      a.selectedOption !== undefined &&
      !['A', 'B', 'C', 'D'].includes(a.selectedOption as string)
    ) {
      return { valid: false, error: `answers[${i}].selectedOption must be A, B, C, or D.` };
    }
    if (
      a.numericalValue !== undefined &&
      typeof a.numericalValue !== 'number'
    ) {
      return { valid: false, error: `answers[${i}].numericalValue must be a number.` };
    }
  }

  return { valid: true };
}
