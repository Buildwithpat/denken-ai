/**
 * Roadmap Service — orchestrates the roadmap engine, generates daily missions,
 * and assembles the full RoadmapResponse for the API.
 */

import { Types } from 'mongoose';
import { computeTopicWeights }           from './topicWeightService';
import { buildSubjectTracks, ChapterCard } from './roadmapEngine';
import MistakePattern, { IMistakePatternDocument } from '../models/MistakePattern';
import {
  resolveExamMeta,
  toISODate,
  studyPhaseFor,
  type StudyPhase,
} from '../lib/studyUtils';
import { cacheGet, cacheSet, CacheKey, TTL } from '../lib/cache';

// ── Public types ──────────────────────────────────────────────────────────────

export type RoadmapPhase =
  | 'foundation-building'
  | 'core-strengthening'
  | 'advanced-problem-solving'
  | 'intensive-revision'
  | 'mock-domination'
  | 'final-sprint';

export interface MissionTask {
  id:          string;
  title:       string;
  type:        'revise' | 'test' | 'formulas' | 'new-chapter' | 'mistake-drill';
  subject:     string;
  chapter:     string;
  durationMin: number;
  href:        string | null;
  urgency:     'critical' | 'high' | 'medium' | 'low';
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
  subjectTracks:    import('./roadmapEngine').SubjectTrack[];
  dailyMission:     DailyMission;
  phaseInsight:     string;
  isNewUser:        boolean;
}

// ── Phase mapping ─────────────────────────────────────────────────────────────

const ROADMAP_PHASE_LABELS: Record<RoadmapPhase, string> = {
  'foundation-building':      'Foundation Building',
  'core-strengthening':       'Core Strengthening',
  'advanced-problem-solving': 'Advanced Problem Solving',
  'intensive-revision':       'Intensive Revision',
  'mock-domination':          'Mock Domination',
  'final-sprint':             'Final Sprint',
};

function toRoadmapPhase(phase: StudyPhase, daysToExam: number | null): RoadmapPhase {
  switch (phase) {
    case 'foundation':    return 'foundation-building';
    case 'consolidation': return 'core-strengthening';
    case 'intensive':     return 'advanced-problem-solving';
    case 'revision':      return 'intensive-revision';
    case 'final':         return daysToExam !== null && daysToExam <= 7 ? 'final-sprint' : 'mock-domination';
    default:              return 'final-sprint';
  }
}

function phaseInsightFor(phase: RoadmapPhase, isNewUser: boolean): string {
  if (isNewUser) return 'Start your journey. Pick one high-weightage chapter per subject and build your first study habit.';
  switch (phase) {
    case 'foundation-building':
      return 'Build strong fundamentals. Focus on high-weightage chapters and solidify your conceptual base before moving ahead.';
    case 'core-strengthening':
      return 'You have the basics. Now deepen your understanding across all core chapters and start timed practice.';
    case 'advanced-problem-solving':
      return 'Push harder. Tackle tough problems and close the remaining weak chapters before revision mode begins.';
    case 'intensive-revision':
      return 'Revision mode is on. Rapidly cycle through all chapters, prioritising topics where retention has dropped.';
    case 'mock-domination':
      return 'Run full mocks daily. Every score is data — identify last-minute gaps and drill them the same day.';
    case 'final-sprint':
      return 'Final stretch. Only high-weightage chapters and persistent mistake patterns matter. Stay sharp, stay calm.';
  }
}

// ── Syllabus progress ─────────────────────────────────────────────────────────

function computeProgress(tracks: import('./roadmapEngine').SubjectTrack[]): number {
  const total    = tracks.reduce((s, t) => s + t.totalChapters, 0);
  const mastered = tracks.reduce((s, t) => s + t.chaptersCompleted, 0);
  const started  = tracks.reduce(
    (s, t) => s + t.chapters.filter(c => c.status === 'in-progress').length, 0,
  );
  if (total === 0) return 0;
  return Math.round(((mastered + started * 0.5) / total) * 100);
}

// ── Daily Mission builder ─────────────────────────────────────────────────────

function missionTitleFor(chapters: ChapterCard[]): string {
  const subjects = [...new Set(chapters.map(c => c.subject))];
  if (subjects.length === 1) return `${subjects[0]} Focus Session`;
  if (chapters.some(c => c.status === 'needs-revision')) return 'Weak Topics Strike';
  return 'Multi-Subject Power Session';
}

function focusSummaryFor(chapters: ChapterCard[]): string {
  const names = chapters.slice(0, 2).map(c => c.chapter);
  return names.join(' · ') + (chapters.length > 2 ? ` + ${chapters.length - 2} more` : '');
}

function taskForChapter(card: ChapterCard, idx: number): MissionTask {
  const enc = encodeURIComponent;

  if (card.hasMistakes && (card.status === 'needs-revision' || card.status === 'in-progress')) {
    return {
      id:          `task-${idx}`,
      title:       `Drill mistakes — ${card.chapter}`,
      type:        'mistake-drill',
      subject:     card.subject,
      chapter:     card.chapter,
      durationMin: 20,
      href:        `/revision?type=mistakes&topic=${enc(card.chapter)}`,
      urgency:     card.priority,
    };
  }

  if (card.status === 'not-started') {
    return {
      id:          `task-${idx}`,
      title:       `Start ${card.chapter}`,
      type:        'new-chapter',
      subject:     card.subject,
      chapter:     card.chapter,
      durationMin: 30,
      href:        `/revision?topic=${enc(card.chapter)}`,
      urgency:     card.priority,
    };
  }

  if (card.status === 'needs-revision') {
    return {
      id:          `task-${idx}`,
      title:       `Revise ${card.chapter}`,
      type:        'revise',
      subject:     card.subject,
      chapter:     card.chapter,
      durationMin: 25,
      href:        `/revision?topic=${enc(card.chapter)}`,
      urgency:     card.priority,
    };
  }

  if (card.linkedFormulaSlug && card.forgettingFactor > 0.4) {
    return {
      id:          `task-${idx}`,
      title:       `Formula refresh — ${card.chapter}`,
      type:        'formulas',
      subject:     card.subject,
      chapter:     card.chapter,
      durationMin: 15,
      href:        card.linkedFormulaSubject
        ? `/formula/${card.linkedFormulaSubject}/${card.linkedFormulaSlug}`
        : null,
      urgency:     card.priority,
    };
  }

  return {
    id:          `task-${idx}`,
    title:       `Practice test — ${card.chapter}`,
    type:        'test',
    subject:     card.subject,
    chapter:     card.chapter,
    durationMin: 25,
    href:        `/denkenstudio?topic=${enc(card.chapter)}&subject=${enc(card.subjectSlug)}`,
    urgency:     card.priority,
  };
}

function buildDailyMission(
  tracks: import('./roadmapEngine').SubjectTrack[],
  today: string,
): DailyMission {
  // Gather top ROI chapters across all subjects (at least one per subject if possible)
  const topPerSubject = tracks.map(t =>
    t.chapters.filter(c => c.priority === 'critical' || c.priority === 'high').slice(0, 1)[0]
    ?? t.chapters[0],
  ).filter(Boolean);

  // Add a few more critical/high chapters from any subject to fill up to 4 tasks
  const allSorted = tracks
    .flatMap(t => t.chapters)
    .sort((a, b) => b.roiScore - a.roiScore);

  const picked: ChapterCard[] = [...topPerSubject];
  for (const c of allSorted) {
    if (picked.length >= 4) break;
    if (!picked.some(p => p.chapter === c.chapter)) picked.push(c);
  }

  const tasks = picked.map((card, i) => taskForChapter(card, i));
  const estimatedMinutes = tasks.reduce((s, t) => s + t.durationMin, 0);

  return {
    date:             today,
    missionTitle:     missionTitleFor(picked),
    focusSummary:     focusSummaryFor(picked),
    tasks,
    estimatedMinutes,
  };
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function getExamRoadmap(
  userId: string,
  exam:   string = 'JEE_MAIN',
): Promise<RoadmapResponse> {
  // Cache check (roadmap is expensive — 2 DB queries + engine computation)
  const cacheKey = CacheKey.roadmap(userId, exam);
  const cached   = await cacheGet<RoadmapResponse>(cacheKey);
  if (cached) return cached;

  const now   = new Date();
  const today = toISODate(now);

  // Resolve exam phase
  const { daysToExam, phase: studyPhase } = resolveExamMeta(exam, undefined, now, 86_400_000);
  const phase      = toRoadmapPhase(studyPhase, daysToExam);
  const phaseLabel = ROADMAP_PHASE_LABELS[phase];

  // Load topic weights and mistake patterns in parallel
  const uid = new Types.ObjectId(userId);
  const [topicWeights, mistakePatterns] = await Promise.all([
    computeTopicWeights(userId),
    MistakePattern.find({ userId: uid }).lean<IMistakePatternDocument[]>(),
  ]);

  const isNewUser = topicWeights.size === 0;

  // Build subject tracks via engine
  const subjectTracks = buildSubjectTracks(topicWeights, mistakePatterns);

  // Compute progress and mission
  const syllabusProgress = computeProgress(subjectTracks);
  const dailyMission     = buildDailyMission(subjectTracks, today);
  const phaseInsight     = phaseInsightFor(phase, isNewUser);

  const response: RoadmapResponse = {
    exam,
    phase,
    phaseLabel,
    daysToExam,
    syllabusProgress,
    subjectTracks,
    dailyMission,
    phaseInsight,
    isNewUser,
  };

  void cacheSet(cacheKey, response, TTL.ROADMAP);
  return response;
}
