import { api } from './api';

// mirrors readinessService.ts types exactly
export type BurnoutRisk        = 'none' | 'low' | 'moderate' | 'high';
export type StudyPhase         = 'foundation' | 'consolidation' | 'intensive' | 'revision' | 'final' | 'post-exam';
export type ConfidenceBandWidth = 'narrow' | 'moderate' | 'wide';
export type IntensityChange    = 'increase' | 'maintain' | 'reduce';
export type ReadinessTrend     = 'improving' | 'stable' | 'declining';

export interface SubjectReadiness {
  subject:          string;
  score:            number;
  accuracy:         number;
  retentionHealth:  number;
  consistencyScore: number;
  trend:            ReadinessTrend;
  weakTopicCount:   number;
  criticalTopics:   string[];
}

export interface ConfidenceBand {
  low:      number;
  expected: number;
  high:     number;
  width:    ConfidenceBandWidth;
  note:     string;
}

export interface WeaknessForecast {
  topic:             string;
  subject:           string;
  currentRetention:  number;
  examDateRetention: number | null;
  errorRate:         number;
  riskLevel:         'critical' | 'high' | 'medium';
  recommendation:    string;
}

export interface PercentileEstimate {
  estimated:  number;
  rangeLow:   number;
  rangeHigh:  number;
  exam:       string;
  caveat:     string;
}

export interface PlannerFeedback {
  baseDailyMin:        number;
  adjustedDailyMin:    number;
  intensityChange:     IntensityChange;
  urgentSubjects:      string[];
  restDaysRecommended: number;
  criticalMessage:     string | null;
  topActions:          string[];
}

export interface ReadinessReport {
  overall:          number;
  confidence:       ConfidenceBand;
  subjects:         SubjectReadiness[];
  percentile:       PercentileEstimate | null;
  weaknessForecast: WeaknessForecast[];
  plannerFeedback:  PlannerFeedback;
  studyPhase:       StudyPhase;
  phaseLabel:       string;
  daysToExam:       number | null;
  examDate:         string | null;
  streakDays:       number;
  burnoutRisk:      BurnoutRisk;
  generatedAt:      string;
}

export const fetchReadinessReport = () =>
  api.get<ReadinessReport>('/readiness', { auth: true });
