import { api } from './api';

export type ExplanationStyle =
  | 'step-by-step'
  | 'beginner'
  | 'intermediate'
  | 'advanced'
  | 'mistake-aware'
  | 'alternative';

export interface QuestionExplanation {
  stableId:          string;
  style:             ExplanationStyle;
  explanation:       string;
  stepByStep:        string[];
  keyInsight:        string;
  commonMistakes:    string[];
  hintsProgressive:  string[];
  alternativeMethod?: string;
  formulasUsed:      string[];
  generatedBy:       string;
  expiresAt:         string;
}

export interface ConceptGap {
  conceptId:       string;
  conceptName:     string;
  subject:         string;
  chapter:         string;
  topic:           string;
  gapSeverity:     'critical' | 'moderate' | 'minor';
  enablesConcepts: string[];
  formulaLinks:    string[];
}

export interface ConceptMasteryEntry {
  conceptId:       string;
  conceptName:     string;
  subject:         string;
  chapter:         string;
  topic:           string;
  masteryScore:    number;
  retentionScore:  number;
  questionCount:   number;
  accuracy:        number;
  dominantMistake: string | null;
  prerequisites:   string[];
  enables:         string[];
}

export interface ConceptInsights {
  masteredConcepts:    ConceptMasteryEntry[];
  weakConcepts:        ConceptMasteryEntry[];
  gaps:                ConceptGap[];
  unlockableConcepts:  string[];
}

export interface HintsResponse {
  hints: string[];
  level: number;
}

export const questionApi = {
  getExplanation(stableId: string, style: ExplanationStyle = 'step-by-step', mistakeType?: string) {
    const params = new URLSearchParams({ style });
    if (mistakeType) params.set('mistakeType', mistakeType);
    return api.get<QuestionExplanation>(`/explanation/${stableId}?${params}`, { auth: true });
  },

  getHints(stableId: string, level: 1 | 2 | 3 = 1) {
    return api.get<HintsResponse>(`/explanation/${stableId}/hints?level=${level}`, { auth: true });
  },

  getConceptInsights(subject?: string) {
    const params = subject ? `?subject=${encodeURIComponent(subject)}` : '';
    return api.get<ConceptInsights>(`/question-bank/concept-insights${params}`, { auth: true });
  },

  getConceptMap(subject: string, topic: string) {
    const params = new URLSearchParams({ subject, topic });
    return api.get<{ concepts: unknown[]; formulaLinks: string[] }>(
      `/question-bank/concept-map?${params}`,
      { auth: true },
    );
  },
};
