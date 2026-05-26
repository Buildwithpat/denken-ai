import { api } from './api';

/* ─── AI service response shapes (mirrors FastAPI NotesResponse exactly) ──── */

export interface AiNoteSection {
  heading: string;
  content: string;
}

export interface AiNotesResponse {
  topic:        string;
  subject:      string;
  depth:        string;
  sections:     AiNoteSection[];
  formulas:     string[];
  key_points:   string[];
  generated_by: 'mock' | 'gemini' | 'openrouter';
}

/* ─── Frontend NoteContent shape (same as notes/page.tsx local types) ──────── */

export interface ConceptEntry    { heading: string; body: string }
export interface QAItem          { q: string; a: string }

export interface StructuredTheory {
  concepts:     string[];
  explanations: ConceptEntry[];
  mistakes:     string[];
}

export interface StructuredFormula {
  name:        string;
  formula:     string;
  description: string;
}

export interface NoteContent {
  type:      string;
  depth:     string;
  theory?:   StructuredTheory;
  formulas?: StructuredFormula[];
  points?:   string[];
  qa?:       QAItem[];
}

/* ─── Request ─────────────────────────────────────────────────────────────── */

export interface NotesRequest {
  topic:    string;
  subject:  string;
  exam?:    string;
  depth:    'short' | 'medium' | 'detailed';
  mode:     'theory' | 'formula' | 'both';
}

/* ─── API call ────────────────────────────────────────────────────────────── */

export async function fetchNotes(req: NotesRequest): Promise<AiNotesResponse> {
  return api.post<AiNotesResponse>('/notes/generate', req, { auth: true });
}

/* ─── Map AI response → NoteContent ──────────────────────────────────────────
   The AI service returns flat sections[] with heading+content and separate
   formulas/key_points arrays. We reconstruct the structured NoteContent shape
   that the notes page renders.
──────────────────────────────────────────────────────────────────────────── */

export function mapAiResponseToNoteContent(
  res: AiNotesResponse,
  noteType: string,
  depth: string,
): NoteContent {
  const theory: StructuredTheory | undefined =
    res.sections.length > 0 || res.key_points.length > 0
      ? {
          concepts:     res.key_points.length > 0 ? res.key_points : res.sections.map(s => s.heading),
          explanations: res.sections.map(s => ({ heading: s.heading, body: s.content })),
          mistakes:     [],
        }
      : undefined;

  const formulas: StructuredFormula[] | undefined =
    res.formulas.length > 0
      ? res.formulas.map((f, i) => ({
          name:        `Formula ${i + 1}`,
          formula:     f,
          description: '',
        }))
      : undefined;

  const lowerType = noteType.toLowerCase();

  if (lowerType.includes('formula') && !lowerType.includes('both')) {
    return { type: noteType, depth, formulas };
  }
  if (lowerType.includes('both')) {
    return { type: noteType, depth, theory, formulas };
  }
  if (lowerType.includes('key point')) {
    return { type: noteType, depth, points: res.key_points };
  }
  return { type: noteType, depth, theory };
}
