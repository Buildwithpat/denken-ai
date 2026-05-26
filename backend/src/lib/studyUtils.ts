/**
 * Shared constants and pure helpers used by plannerService, readinessService,
 * and revisionService.  No Mongoose imports — this file must stay side-effect-free.
 */

export type StudyPhase  = 'foundation' | 'consolidation' | 'intensive' | 'revision' | 'final' | 'post-exam';
export type BurnoutRisk = 'none' | 'low' | 'moderate' | 'high';

// ── Exam calendar ─────────────────────────────────────────────────────────────

export const EXAM_MONTH_DAY: Record<string, [number, number]> = {
  jee:          [5,  1],
  jee_main:     [5,  1],
  jee_advanced: [5, 20],
  neet:         [5,  5],
  cbse:         [3,  1],
};

// ── Phase config ──────────────────────────────────────────────────────────────

export const PHASE_DAILY_MIN: Record<StudyPhase, number> = {
  foundation:    180,
  consolidation: 210,
  intensive:     270,
  revision:      300,
  final:         240,
  'post-exam':    60,
};

export const PHASE_LABELS: Record<StudyPhase, string> = {
  foundation:    'Foundation Phase',
  consolidation: 'Consolidation Phase',
  intensive:     'Intensive Phase',
  revision:      'Revision Phase',
  final:         'Final Sprint',
  'post-exam':   'Post-Exam',
};

// ── Date helpers ──────────────────────────────────────────────────────────────

export function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function getExamDate(exam: string, targetYear?: number): Date | null {
  const key   = exam.toLowerCase().replace(/[\s-]/g, '_');
  const entry = EXAM_MONTH_DAY[key];
  if (!entry) return null;
  const [month, day] = entry;
  const now  = new Date();
  const year = targetYear ?? ((now.getMonth() + 1) > month ? now.getFullYear() + 1 : now.getFullYear());
  return new Date(year, month - 1, day);
}

export function daysUntil(target: Date): number {
  return Math.ceil((target.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function resolveExamMeta(
  targetExam:  string,
  targetYear:  number | undefined,
  now:         Date,
  msPerDay:    number,
): { daysToExam: number | null; examDate: string | null; phase: StudyPhase } {
  const key   = targetExam.toLowerCase().replace(/[\s-]/g, '_');
  const entry = EXAM_MONTH_DAY[key];
  if (!entry) return { daysToExam: null, examDate: null, phase: 'foundation' };

  const [month, day] = entry;
  const year = targetYear ?? ((now.getMonth() + 1) > month ? now.getFullYear() + 1 : now.getFullYear());
  const examDateObj  = new Date(year, month - 1, day);
  const daysToExam   = Math.ceil((examDateObj.getTime() - now.getTime()) / msPerDay);

  return { daysToExam, examDate: examDateObj.toISOString().slice(0, 10), phase: studyPhaseFor(daysToExam) };
}

// ── Phase / burnout helpers ───────────────────────────────────────────────────

export function studyPhaseFor(daysToExam: number): StudyPhase {
  if (daysToExam <    0) return 'post-exam';
  if (daysToExam <=  15) return 'final';
  if (daysToExam <=  30) return 'revision';
  if (daysToExam <=  60) return 'intensive';
  if (daysToExam <= 120) return 'consolidation';
  return 'foundation';
}

export function burnoutRiskFor(activeDaysLast14: number): BurnoutRisk {
  if (activeDaysLast14 >= 11) return 'high';
  if (activeDaysLast14 >=  8) return 'moderate';
  if (activeDaysLast14 >=  5) return 'low';
  return 'none';
}

export function computeStreakFromSet(activityDates: Set<string>, now: Date = new Date()): number {
  let streak = 0;
  const cursor = new Date(now);
  cursor.setHours(0, 0, 0, 0);
  while (activityDates.has(toISODate(cursor))) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

// ── Ebbinghaus retention model ────────────────────────────────────────────────

export function ebbinghaus(halfLifeDays: number, daysSinceSeen: number): number {
  return 100 * Math.exp((-Math.LN2 / halfLifeDays) * daysSinceSeen);
}

export function halfLifeForAccuracy(accuracy: number): number {
  if (accuracy >= 90) return 21;
  if (accuracy >= 75) return 14;
  if (accuracy >= 60) return  7;
  if (accuracy >= 40) return  3;
  return 1;
}

/** Returns a 0–1 retention decay factor (0 = fully retained, 1 = fully forgotten). */
export function retentionDecayFactor(accuracy: number, daysSinceSeen: number): number {
  const retention = ebbinghaus(halfLifeForAccuracy(accuracy), daysSinceSeen) / 100;
  return 1 - retention;
}
