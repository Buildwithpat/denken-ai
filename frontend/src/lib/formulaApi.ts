import { api } from './api';
import type {
  SubjectSummary,
  ChapterSummary,
  ChapterDetail,
  FormulaSearchResult,
} from '@/types/formula';

// Map frontend subject display names → dataset subject slugs
const DISPLAY_TO_SLUG: Record<string, string> = {
  Physics:     'physics',
  Chemistry:   'chemistry',
  Mathematics: 'maths',
  Maths:       'maths',
  Biology:     'biology',
};

export function subjectToSlug(displayName: string): string {
  return DISPLAY_TO_SLUG[displayName] ?? displayName.toLowerCase();
}

export function slugToSubject(slug: string): string {
  const map: Record<string, string> = {
    physics:   'Physics',
    chemistry: 'Chemistry',
    maths:     'Mathematics',
    biology:   'Biology',
  };
  return map[slug] ?? slug.charAt(0).toUpperCase() + slug.slice(1);
}

// ── API calls ─────────────────────────────────────────────────────────────────

export async function fetchFormulaSubjects(exam?: string): Promise<SubjectSummary[]> {
  const qs = exam ? `?exam=${encodeURIComponent(exam)}` : '';
  const res = await api.get<{ subjects: SubjectSummary[] }>(`/formula/subjects${qs}`);
  return res.subjects;
}

export async function fetchFormulaChapters(
  subjectSlug: string,
  exam?: string,
): Promise<ChapterSummary[]> {
  const qs = exam ? `?exam=${encodeURIComponent(exam)}` : '';
  const res = await api.get<{ subject: string; chapters: ChapterSummary[] }>(
    `/formula/chapters/${encodeURIComponent(subjectSlug)}${qs}`,
  );
  return res.chapters;
}

export async function fetchFormulaChapter(
  subjectSlug: string,
  chapterSlug: string,
): Promise<ChapterDetail> {
  return api.get<ChapterDetail>(
    `/formula/chapter/${encodeURIComponent(subjectSlug)}/${encodeURIComponent(chapterSlug)}`,
  );
}

export async function searchFormulas(
  query: string,
  opts?: { subject?: string; exam?: string; limit?: number },
): Promise<FormulaSearchResult[]> {
  const params = new URLSearchParams({ q: query });
  if (opts?.subject) params.set('subject', opts.subject);
  if (opts?.exam)    params.set('exam',    opts.exam);
  if (opts?.limit)   params.set('limit',   String(opts.limit));
  const res = await api.get<{ results: FormulaSearchResult[] }>(`/formula/search?${params}`);
  return res.results;
}
