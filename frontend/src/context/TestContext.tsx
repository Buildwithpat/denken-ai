'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

/* ─── Types ──────────────────────────────────────────────────────────────── */

export type TestMode    = 'rapid' | 'pyq' | 'mistake' | 'normal' | 'smart';
export type TestExam    = 'JEE' | 'JEE_MAIN' | 'JEE_ADVANCED' | 'NEET' | 'CBSE' | 'CUSTOM';
export type StudioType  = 'weightage' | 'weakness' | 'difficulty' | 'revision' | 'surprise' | 'balanced-mock' | 'exam-adaptive' | 'high-roi' | 'crash-course' | 'formula-heavy';

export interface TestConfig {
  mode:               TestMode;
  exam:               TestExam;
  subject:            string;
  chapter:            string;
  questions:          number;
  time:               number;
  year?:              string;
  studioType?:        StudioType;
  difficulty?:        string;
  adaptiveReasoning?: string[];
}

export interface AttemptedQuestion {
  id:      number;
  subject: string;
  type:    'mcq' | 'numerical' | 'subjective';
}

export interface TestResult {
  exam:             string;
  mode:             string;
  subject:          string;
  chapter:          string;
  questions:        AttemptedQuestion[];
  answers:          Record<number, number>;
  numericalAnswers: Record<number, string>;
}

export interface BackendQuestion {
  id:                   string;
  subject:              string;
  topic:                string;
  difficulty:           'easy' | 'medium' | 'hard';
  type:                 'mcq' | 'numerical';
  question:             string;
  options?:             [string, string, string, string];
  correctOption?:       'A' | 'B' | 'C' | 'D';
  answer?:              number;
  marks:                number;
  diagramDescription?:  string;
  // Question Intelligence enrichment
  bankQuestionId?:         string;
  chapter?:                string;
  subtopic?:               string;
  conceptTags?:            string[];
  formulaTags?:            string[];
  bloomLevel?:             string;
  skillCategory?:          string;
  learningObjective?:      string;
  expectedSolvingTimeSec?: number;
  prerequisiteTopics?:     string[];
}

export interface BackendSubjectSummary {
  subject:     string;
  correct:     number;
  wrong:       number;
  unattempted: number;
  score:       number;
}

export interface BackendResult {
  id:               string;
  testId:           string;
  totalScore:       number;
  correctCount:     number;
  wrongCount:       number;
  unattemptedCount: number;
  accuracy:         number;
  timeTaken:        number;
  subjectWise:      BackendSubjectSummary[];
}

interface Ctx {
  testConfig:          TestConfig;
  setTestConfig:       (patch: Partial<TestConfig>) => void;
  testResult:          TestResult | null;
  setTestResult:       (r: TestResult) => void;
  testId:              string | null;
  setTestId:           (id: string) => void;
  backendQuestions:    BackendQuestion[] | null;
  setBackendQuestions: (qs: BackendQuestion[]) => void;
  backendResult:       BackendResult | null;
  setBackendResult:    (r: BackendResult) => void;
}

/* ─── Defaults ───────────────────────────────────────────────────────────── */

const DEFAULTS: TestConfig = {
  mode:      'normal',
  exam:      'JEE',
  subject:   '',
  chapter:   '',
  questions: 20,
  time:      30,
};

/* ─── Context ────────────────────────────────────────────────────────────── */

const TestCtx = createContext<Ctx | null>(null);

export function TestProvider({ children }: { children: ReactNode }) {
  const [testConfig,       setConfig]           = useState<TestConfig>(DEFAULTS);
  const [testResult,       setTestResult]       = useState<TestResult | null>(null);
  const [testId,           setTestId]           = useState<string | null>(null);
  const [backendQuestions, setBackendQuestions] = useState<BackendQuestion[] | null>(null);
  const [backendResult,    setBackendResult]    = useState<BackendResult | null>(null);

  function setTestConfig(patch: Partial<TestConfig>) {
    setConfig(prev => ({ ...prev, ...patch }));
  }

  return (
    <TestCtx.Provider value={{
      testConfig, setTestConfig,
      testResult, setTestResult,
      testId, setTestId,
      backendQuestions, setBackendQuestions,
      backendResult, setBackendResult,
    }}>
      {children}
    </TestCtx.Provider>
  );
}

export function useTestConfig() {
  const ctx = useContext(TestCtx);
  if (!ctx) throw new Error('useTestConfig must be used inside TestProvider');
  return ctx;
}
