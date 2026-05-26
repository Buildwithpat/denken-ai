import { api } from './api';

export type MistakeType =
  | 'conceptual'
  | 'careless'
  | 'formula'
  | 'time-pressure'
  | 'weak-retention'
  | 'guessing'
  | 'repeated';

export interface MistakeCounts {
  conceptual:    number;
  careless:      number;
  formula:       number;
  timePressure:  number;
  weakRetention: number;
  guessing:      number;
  repeated:      number;
}

export interface MistakePattern {
  topic:                    string;
  subject:                  string;
  totalMistakes:            number;
  recentMistakes:           number;
  consecutiveWrong:         number;
  dominantType:             MistakeType;
  insight:                  string;
  linkedFormulaChapterSlug: string | null;
  linkedSubjectSlug:        string | null;
  lastMistakeAt:            string;
  mistakeCounts:            MistakeCounts;
}

export interface RevisionQueueItem {
  topic:                    string;
  subject:                  string;
  priority:                 'critical' | 'high' | 'medium';
  reason:                   string;
  totalMistakes:            number;
  dominantType:             MistakeType;
  linkedFormulaChapterSlug: string | null;
  linkedSubjectSlug:        string | null;
}

export interface TestMistakeItem {
  questionId: string;
  topic:      string;
  subject:    string;
  type:       MistakeType;
  qType:      'mcq' | 'numerical';
  difficulty: string;
}

export interface TestMistakeSummary {
  totalWrong:   number;
  byType:       Record<MistakeType, number>;
  dominantType: MistakeType | null;
  items:        TestMistakeItem[];
  insight:      string;
}

export async function fetchMistakePatterns(): Promise<MistakePattern[]> {
  const res = await api.get<{ patterns: MistakePattern[] }>('/mistakes/patterns', { auth: true });
  return res.patterns;
}

export async function fetchRevisionQueue(): Promise<RevisionQueueItem[]> {
  const res = await api.get<{ queue: RevisionQueueItem[] }>('/mistakes/revision-queue', { auth: true });
  return res.queue;
}

export async function fetchFormulaLinkedMistakes(): Promise<MistakePattern[]> {
  const res = await api.get<{ patterns: MistakePattern[] }>('/mistakes/formula-linked', { auth: true });
  return res.patterns;
}

export async function fetchTestMistakeAnalysis(resultId: string): Promise<TestMistakeSummary> {
  return api.get<TestMistakeSummary>(`/mistakes/test/${resultId}`, { auth: true });
}
