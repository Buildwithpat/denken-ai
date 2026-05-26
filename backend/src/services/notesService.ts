import { aiServiceClient } from '../lib/aiServiceClient';
import type { AiNotesResponse } from '../lib/aiServiceClient';
import { extractFormulaStrings } from '../lib/formulaLoader';
import { buildGroundingContext, serializeForPrompt } from '../lib/groundingContext';
import { logger } from '../lib/logger';

export type NoteDepth = 'short' | 'medium' | 'detailed';
export type NoteMode  = 'theory' | 'formula' | 'both';

export interface NotesRequest {
  topic:   string;
  subject: string;
  exam:    string;
  depth:   NoteDepth;
  mode:    NoteMode;
}

// Map frontend subject display names to formula dataset slugs
const SUBJECT_SLUG: Record<string, string> = {
  physics:     'physics',
  chemistry:   'chemistry',
  mathematics: 'maths',
  maths:       'maths',
  biology:     'biology',
};

function subjectToSlug(subject: string): string {
  return SUBJECT_SLUG[subject.toLowerCase()] ?? subject.toLowerCase();
}

/**
 * Generate notes for a topic.
 *
 * Strategy:
 *  1. Look up the formula dataset for real formulas matching this chapter.
 *  2. Call the AI service with the request.
 *  3. If the AI returns empty/no formulas AND dataset formulas exist for this
 *     chapter, inject the dataset formulas into the response.
 *
 * This ensures the trusted dataset always takes precedence over hallucinated
 * formula strings from the AI.
 */
export async function generateNotes(req: NotesRequest): Promise<AiNotesResponse | null> {
  const slug = subjectToSlug(req.subject);
  const datasetFormulas = extractFormulaStrings(slug, req.topic);

  // Build PYQ grounding context for this chapter
  const groundingCtx = await buildGroundingContext({
    exam:    req.exam,
    subject: req.subject,
    chapter: req.topic,
    pyqLimit:    3,
    formulaLimit: 6,
  });

  logger.info('[notesService] Grounding context built', {
    topic: req.topic, exam: req.exam,
    pyqsInjected: groundingCtx.debugLog.pyqsSelected,
    formulasInjected: groundingCtx.debugLog.formulasUsed,
    pyqSources: groundingCtx.debugLog.pyqSources,
  });

  const aiResult = await aiServiceClient.generateNotes({
    topic:            req.topic,
    subject:          req.subject,
    exam:             req.exam,
    depth:            req.depth,
    mode:             req.mode,
    pyq_context:      groundingCtx.debugLog.pyqsSelected > 0 ? serializeForPrompt(groundingCtx) : undefined,
    syllabus_context: groundingCtx.syllabusUnits.length > 0 ? groundingCtx.syllabusUnits : undefined,
  });

  if (!aiResult) return null;

  // Inject real dataset formulas when the mode includes formulas and the
  // dataset has content — prevents AI from hallucinating formula strings.
  const wantsFormulas = req.mode === 'formula' || req.mode === 'both';
  if (wantsFormulas && datasetFormulas.length > 0) {
    return {
      ...aiResult,
      formulas: datasetFormulas,
    };
  }

  return aiResult;
}
