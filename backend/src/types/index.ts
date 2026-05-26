export type ExamKey = 'CBSE' | 'JEE_MAIN' | 'JEE_ADVANCED' | 'NEET';
export type Difficulty = 'easy' | 'medium' | 'hard' | 'mixed';
export type TestMode = 'normal' | 'rapid' | 'pyq' | 'mistake' | 'smart';
export type ResolvedDifficulty = 'easy' | 'medium' | 'hard';
export type QuestionType = 'mcq' | 'numerical';
export type CbseClassFilter = '11' | '12' | 'both';
export type AdaptiveMode = 'weak-topic' | 'revision' | 'surprise' | 'balanced-mock' | 'exam-adaptive' | 'high-roi' | 'crash-course' | 'formula-heavy';
export type AdaptiveUrgency = 'critical' | 'high' | 'medium' | 'low';

/** Per-topic adaptive weight produced by topicWeightService. */
export interface TopicWeight {
  subject: string;
  accuracy: number;
  wrongCount: number;
  totalAttempted: number;
  errorRate: number;
  recentWrong: boolean;
  subjectTrend: number;
  daysSinceLastSeen: number;
  weight: number;
  suggestedDifficulty: Difficulty;
  /** Ebbinghaus-based retention estimate 0–100. */
  retentionScore: number;
  /** Combined mastery: accuracy×0.6 + retention×0.4, range 0–100. */
  masteryScore: number;
  /** Forgetting factor 0–1 (1 = fully forgotten). */
  forgettingFactor: number;
}

export interface ExamMeta {
  maxQuestions: number;
  duration: number;
  marking: { correct: number; wrong: number };
  questionTypes: QuestionType[];
}

export type BloomLevel    = 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';
export type SkillCategory = 'recall' | 'understanding' | 'application' | 'analysis' | 'synthesis' | 'evaluation';

export interface Question {
  id: string;
  subject: string;
  topic: string;
  topicType: 'chapter' | 'unit';
  difficulty: ResolvedDifficulty;
  type: 'mcq' | 'numerical';
  question: string;
  options?: [string, string, string, string];
  correctOption?: 'A' | 'B' | 'C' | 'D';
  answer?: number;
  marks: number;
  /** Text description of the diagram/figure referenced in the question, if any */
  diagramDescription?: string;
  // ── Question Intelligence enrichment (present when sourced from QuestionBank) ─
  bankQuestionId?:        string;    // QuestionBank.stableId
  chapter?:               string;    // roadmap chapter name
  subtopic?:              string;
  conceptTags?:           string[];
  formulaTags?:           string[];
  bloomLevel?:            BloomLevel;
  skillCategory?:         SkillCategory;
  learningObjective?:     string;
  expectedSolvingTimeSec?: number;
  prerequisiteTopics?:    string[];
}

export interface GenerateTestRequest {
  exam: ExamKey;
  subjects: string[];
  chapters?: string[];
  difficulty?: Difficulty;
  questionCount?: number;
  cbseClass?: CbseClassFilter;
  mode?: TestMode;
  /** Semantic adaptive mode that influences topic boosting logic. */
  adaptiveMode?: AdaptiveMode;
  /** Populated by the controller from topicWeightService; absent = equal distribution. */
  topicWeights?: Map<string, TopicWeight>;
  /**
   * User-selected question type mode:
   *   'mcq'      — MCQ only (all exams)
   *   'numerical' — Numerical only (JEE only; NEET/CBSE silently falls back to mcq)
   *   'mixed'    — Balanced mix of MCQ + Numerical (JEE: ~35% numerical)
   * Default: 'mixed' for JEE, 'mcq' for NEET/CBSE
   */
  questionTypeMode?: 'mcq' | 'numerical' | 'mixed';
}

export interface SubmittedAnswer {
  questionId: string;
  selectedOption?: 'A' | 'B' | 'C' | 'D';
  numericalValue?: number;
  isMarked?: boolean;
}

export interface SubmitTestRequest {
  testId: string;
  timeTaken: number;
  answers: SubmittedAnswer[];
}

export interface GeneratedTest {
  exam: ExamKey;
  totalQuestions: number;
  duration: number;
  marking: { correct: number; wrong: number };
  subjects: string[];
  questions: Question[];
  generatedAt: string;
}

export interface CbseSubject {
  name: string;
  chapters: string[];
}

export interface JeeNeetSubject {
  name: string;
  units: string[];
}

export interface SubjectTopics {
  name: string;
  topics: string[];
  topicKey: 'chapters' | 'units';
}

export interface TopicEntry {
  subject: string;
  topic: string;
  topicKey: 'chapters' | 'units';
}
