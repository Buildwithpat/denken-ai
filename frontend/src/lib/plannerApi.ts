import { api } from './api';

// ── Shared types (mirrors plannerService.ts) ──────────────────────────────────

export type StudyPhase    = 'foundation' | 'consolidation' | 'intensive' | 'revision' | 'final' | 'post-exam';
export type BurnoutRisk   = 'none' | 'low' | 'moderate' | 'high';
export type IntensityChange = 'increase' | 'maintain' | 'reduce';
export type LoadLevel     = 'light' | 'moderate' | 'heavy';
export type ActivityType  = 'theory' | 'practice' | 'review' | 'mock_prep';
export type SessionSlot   = 'morning' | 'afternoon' | 'evening';
export type PriorityLabel = 'critical' | 'high' | 'medium' | 'low';

export interface AdaptiveTestSuggestion {
  mode:    string;
  title:   string;
  reason:  string;
  urgency: string;
}

export interface StudySession {
  slot:                 SessionSlot;
  subject:              string;
  topic:                string;
  activity:             ActivityType;
  durationMin:          number;
  priority:             PriorityLabel;
  rationale:            string;
  /** Data-driven explanation: "retention dropped to 41%" etc. */
  reasoning:            string;
  masteryScore:         number;
  retentionScore:       number;
  mistakeType:          string | null;
  linkedFormulaSlug:    string | null;
  linkedFormulaSubject: string | null;
  /** Whether to surface an adaptive test CTA for this session */
  suggestTest:          boolean;
}

export interface DayPlan {
  date:      string;
  dayLabel:  string;
  isRestDay: boolean;
  sessions:  StudySession[];
  totalMin:  number;
  loadLevel: LoadLevel;
}

export interface PlannerTopicHint {
  topic:           string;
  subject:         string;
  reason:          string;
  urgent?:         boolean;
  masteryScore?:   number;
  retentionScore?: number;
}

export interface PlannerSummary {
  daysToExam:             number | null;
  examDate:               string | null;
  studyPhase:             StudyPhase;
  phaseLabel:             string;
  phaseDescription:       string;
  weeklyGoal:             string;
  dailyTargetMin:         number;
  topPriorityTopics:      PlannerTopicHint[];
  burnoutRisk:            BurnoutRisk;
  streakDays:             number;
  readinessScore:         number;
  adjustedDailyMin:       number;
  intensityChange:        IntensityChange;
  urgentSubjects:         string[];
  criticalMessage:        string | null;
  todayInsight:           string;
  syllabusProgress:       number;
  mistakeInsights:        string[];
  adaptiveTestSuggestion: AdaptiveTestSuggestion | null;
  isNewUser:              boolean;
}

export interface WeekPlan {
  summary:     PlannerSummary;
  days:        DayPlan[];
  generatedAt: string;
}

// ── API calls ─────────────────────────────────────────────────────────────────

export const fetchWeekPlan       = () => api.get<WeekPlan>('/planner/week',          { auth: true });
export const fetchDayPlan        = () => api.get<DayPlan>('/planner/day',             { auth: true });
export const fetchPlannerSummary = () => api.get<PlannerSummary>('/planner/summary',  { auth: true });
