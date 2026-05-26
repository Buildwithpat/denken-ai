import { api } from './api';

export interface AnalyticsOverview {
  testsTaken:    number;
  avgAccuracy:   number;
  bestAccuracy:  number;
  currentStreak: number;
  longestStreak: number;
}

export interface SubjectAnalytics {
  subject:     string;
  correct:     number;
  wrong:       number;
  unattempted: number;
  accuracy:    number;
  trend:       number;
}

export interface WeakTopic {
  topic:          string;
  subject:        string;
  wrongCount:     number;
  totalAttempted: number;
  accuracy:       number;
  masteryScore:   number;
  retentionScore: number;
  lastSeenAt:     string;
}

export interface StrongTopic {
  topic:          string;
  subject:        string;
  accuracy:       number;
  masteryScore:   number;
  totalAttempted: number;
}

export interface QuestionTypeAnalytics {
  type:     string;
  correct:  number;
  wrong:    number;
  attempted: number;
  accuracy: number;
}

export interface TrendPoint {
  accuracy: number;
  exam:     string;
  date:     string;
}

export interface ActivityPoint {
  date:  string;
  count: number;
}

export interface RecommendationItem {
  title:     string;
  body:      string;
  sentiment: 'success' | 'warning' | 'danger';
}

export interface RevisionItem {
  day:      string;
  topic:    string;
  subject:  string;
  duration: string;
}

export interface LastTestInfo {
  exam:     string;
  subjects: string[];
  accuracy: number;
  date:     string;
}

export interface AnalyticsData {
  overview:       AnalyticsOverview;
  trends:         TrendPoint[];
  subjects:       SubjectAnalytics[];
  weakTopics:     WeakTopic[];
  strengths:      StrongTopic[];
  questionTypes:  QuestionTypeAnalytics[];
  activity:       ActivityPoint[];
  recommendations: RecommendationItem[];
  revisionRoadmap: RevisionItem[];
  lastTest:       LastTestInfo | null;
  exam:           string | null;
  _tier?:         'full' | 'free';
}

export async function fetchAnalytics(): Promise<AnalyticsData> {
  return api.get<AnalyticsData>('/analytics', { auth: true });
}
