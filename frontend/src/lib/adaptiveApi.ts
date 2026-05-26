import { api } from './api';

export type AdaptiveMode    = 'weak-topic' | 'revision' | 'surprise' | 'balanced-mock' | 'exam-adaptive' | 'high-roi' | 'crash-course' | 'formula-heavy';
export type AdaptiveUrgency = 'critical' | 'high' | 'medium' | 'low';

export interface TestRecommendation {
  mode:              AdaptiveMode;
  title:             string;
  description:       string;
  urgency:           AdaptiveUrgency;
  headline:          string;
  reasoning:         string[];
  subjects:          string[];
  topicFocus:        string[];
  suggestedChapters: string[];
  difficulty:        string;
  questionCount:     number;
  estimatedDuration: number;
}

export interface AdaptiveRecommendationResponse {
  hasData:  boolean;
  primary:  TestRecommendation | null;
  allModes: TestRecommendation[];
}

export async function fetchTestRecommendations(
  exam:     string,
  subjects: string[],
): Promise<AdaptiveRecommendationResponse> {
  const params = new URLSearchParams({ exam: exam.toUpperCase() });
  if (subjects.length > 0) params.set('subjects', subjects.join(','));
  return api.get<AdaptiveRecommendationResponse>(`/test/recommend?${params}`, { auth: true });
}
