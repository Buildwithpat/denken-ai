import { api } from './api';

// ── Types ─────────────────────────────────────────────────────────────────────

export type PracticeIntent =
  | 'concept-drill'
  | 'prerequisite-fix'
  | 'retention-boost'
  | 'mistake-revisit';

export type PracticeUrgency = 'critical' | 'high' | 'medium' | 'low';
export type NextStep        = 'advance' | 'continue' | 'mentor' | 'rest';

export interface PracticeRecommendation {
  type:             PracticeIntent;
  title:            string;
  description:      string;
  topic:            string;
  subject:          string;
  chapter:          string;
  urgency:          PracticeUrgency;
  estimatedMinutes: number;
  questionCount:    number;
}

export interface PracticeQuestion {
  id:                      string;
  subject:                 string;
  topic:                   string;
  difficulty:              'easy' | 'medium' | 'hard';
  type:                    'mcq' | 'numerical';
  question:                string;
  options?:                [string, string, string, string];
  correctOption?:          'A' | 'B' | 'C' | 'D';
  answer?:                 number;
  marks:                   number;
  bankQuestionId?:         string;
  chapter?:                string;
  conceptTags?:            string[];
  formulaTags?:            string[];
  bloomLevel?:             string;
  expectedSolvingTimeSec?: number;
  // session-specific
  sessionIndex:            number;
  hintAvailable:           boolean;
  targetConceptId?:        string;
}

export interface StartSessionResponse {
  sessionId:     string;
  firstQuestion: PracticeQuestion;
  totalPlanned:  number;
}

export interface AnswerResult {
  feedback:     string;
  isCorrect:    boolean;
  nextQuestion: PracticeQuestion | null;
  sessionDone:  boolean;
  progress: {
    current:  number;
    total:    number;
    accuracy: number;
  };
}

export interface SessionSummary {
  sessionId:             string;
  totalQuestions:        number;
  correctCount:          number;
  accuracy:              number;
  masteryDelta:          number;
  weakConceptIds:        string[];
  suggestedNextStep:     NextStep;
  averageSolvingTimeSec: number;
  answers:               Record<string, boolean>;
}

export interface ConceptGuidanceResponse {
  guidance:      string;
  key_formulas:  string[];
  common_errors: string[];
  next_steps:    string[];
  generated_by:  string;
}

// ── API calls ─────────────────────────────────────────────────────────────────

export const getRecommendations = (exam = 'JEE_MAIN', subject?: string) =>
  api.get<{ recommendations: PracticeRecommendation[] }>(
    `/adaptive-practice/recommendations?exam=${exam}${subject ? `&subject=${encodeURIComponent(subject)}` : ''}`,
    { auth: true },
  );

export const startSession = (body: {
  subject:       string;
  chapter?:      string;
  topic?:        string;
  conceptId?:    string;
  exam:          string;
  questionCount?: number;
  intent?:       PracticeIntent;
}) => api.post<StartSessionResponse>('/adaptive-practice/session', body, { auth: true });

export const submitAnswer = (
  sessionId:      string,
  questionId:     string,
  isCorrect:      boolean,
  solvingTimeSec: number,
) =>
  api.post<AnswerResult>(
    `/adaptive-practice/session/${sessionId}/answer`,
    { questionId, isCorrect, solvingTimeSec },
    { auth: true },
  );

export const getSessionSummary = (sessionId: string) =>
  api.get<SessionSummary>(`/adaptive-practice/session/${sessionId}/summary`, { auth: true });
