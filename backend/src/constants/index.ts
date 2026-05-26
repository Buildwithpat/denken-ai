import { ExamKey, ExamMeta, ResolvedDifficulty } from '../types';

export const EXAM_CONFIG: Record<ExamKey, ExamMeta> = {
  CBSE: {
    maxQuestions: 90,
    duration: 180,
    marking: { correct: 1, wrong: 0 },
    questionTypes: ['mcq'],
  },
  JEE_MAIN: {
    maxQuestions: 75,
    duration: 180,
    marking: { correct: 4, wrong: -1 },
    questionTypes: ['mcq', 'numerical'],
  },
  JEE_ADVANCED: {
    maxQuestions: 54,
    duration: 180,
    marking: { correct: 4, wrong: -2 },
    questionTypes: ['mcq', 'numerical'],
  },
  NEET: {
    maxQuestions: 180,
    duration: 180,
    marking: { correct: 4, wrong: -1 },
    questionTypes: ['mcq'],
  },
};

export const VALID_EXAMS = new Set(Object.keys(EXAM_CONFIG));
export const VALID_DIFFICULTY = new Set(['easy', 'medium', 'hard', 'mixed']);
export const VALID_CBSE_CLASS = new Set(['11', '12', 'both']);
export const VALID_TEST_MODES = new Set(['normal', 'rapid', 'pyq', 'mistake', 'smart']);
export const OPTION_LABELS: ['A', 'B', 'C', 'D'] = ['A', 'B', 'C', 'D'];
export const JEE_EXAMS = new Set<ExamKey>(['JEE_MAIN', 'JEE_ADVANCED']);
export const DIFFICULTY_CYCLE: ResolvedDifficulty[] = ['easy', 'medium', 'hard'];
