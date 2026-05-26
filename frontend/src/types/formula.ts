// Mirrors backend/src/types/formula.ts (normalised API shapes only)

export interface SubjectSummary {
  slug: string;
  name: string;
  chapterCount: number;
}

export interface ChapterSummary {
  chapterId: string;
  chapterName: string;
  slug: string;
  subjectSlug: string;
  subjectName: string;
  examTargets: string[];
  conceptCount: number;
  formulaCount: number;
  tags: string[];
}

export interface FormulaVariable {
  meaning: string;
  unit?: string;
}

export interface FormulaDetail {
  formulaId: string;
  name: string;
  equation: string;
  latex?: string;
  meaning: string;
  variables: Record<string, FormulaVariable>;
  applications: string[];
  commonMistakes: string[];
  conditions: string[];
}

export interface ConceptDetail {
  conceptId: string;
  conceptName: string;
  description: string;
  formulaType: string;
  formulas: FormulaDetail[];
}

export interface ChapterDetail {
  chapterId: string;
  chapterName: string;
  slug: string;
  subjectSlug: string;
  subjectName: string;
  examTargets: string[];
  tags: string[];
  concepts: ConceptDetail[];
  importantNotes: string[];
  commonMistakes: string[];
  jeeAdvancedFocus: string[];
  neetFocus: string[];
  keywords: string[];
  conceptCount: number;
  formulaCount: number;
}

export interface FormulaSearchResult {
  formulaId: string;
  name: string;
  equation: string;
  latex?: string;
  meaning: string;
  conceptName: string;
  chapterId: string;
  chapterName: string;
  chapterSlug: string;
  subjectSlug: string;
  subjectName: string;
  score: number;
}
