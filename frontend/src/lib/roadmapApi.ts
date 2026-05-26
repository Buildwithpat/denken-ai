import { api } from './api';

// ── Shared types ──────────────────────────────────────────────────────────────

export type ChapterStatus   = 'not-started' | 'in-progress' | 'needs-revision' | 'mastered';
export type ChapterPriority = 'critical' | 'high' | 'medium' | 'low';

export type RoadmapPhase =
  | 'foundation-building'
  | 'core-strengthening'
  | 'advanced-problem-solving'
  | 'intensive-revision'
  | 'mock-domination'
  | 'final-sprint';

export interface ChecklistItem {
  id:    string;
  label: string;
  type:  'concept' | 'formula' | 'notes' | 'practice' | 'pyq' | 'test' | 'mistake-revision';
  href:  string | null;
}

export interface ChapterCard {
  chapter:              string;
  subject:              string;
  subjectSlug:          string;
  examWeightage:        number;
  roiScore:             number;
  status:               ChapterStatus;
  masteryScore:         number;
  retentionScore:       number;
  forgettingFactor:     number;
  totalAttempted:       number;
  errorRate:            number;
  hasMistakes:          boolean;
  mistakeDominantType:  string | null;
  linkedFormulaSlug:    string | null;
  linkedFormulaSubject: string | null;
  checklist:            ChecklistItem[];
  priority:             ChapterPriority;
}

export interface SubjectTrack {
  subject:                 string;
  subjectSlug:             string;
  chapters:                ChapterCard[];
  overallMastery:          number;
  chaptersCompleted:       number;
  chaptersNeedingRevision: number;
  totalChapters:           number;
}

export interface MissionTask {
  id:          string;
  title:       string;
  type:        'revise' | 'test' | 'formulas' | 'new-chapter' | 'mistake-drill';
  subject:     string;
  chapter:     string;
  durationMin: number;
  href:        string | null;
  urgency:     ChapterPriority;
}

export interface DailyMission {
  date:             string;
  missionTitle:     string;
  focusSummary:     string;
  tasks:            MissionTask[];
  estimatedMinutes: number;
}

export interface RoadmapResponse {
  exam:             string;
  phase:            RoadmapPhase;
  phaseLabel:       string;
  daysToExam:       number | null;
  syllabusProgress: number;
  subjectTracks:    SubjectTrack[];
  dailyMission:     DailyMission;
  phaseInsight:     string;
  isNewUser:        boolean;
}

// ── API call ──────────────────────────────────────────────────────────────────

export async function fetchRoadmap(exam = 'JEE_MAIN'): Promise<RoadmapResponse> {
  return api.get<RoadmapResponse>(`/roadmap?exam=${exam}`, { auth: true });
}
