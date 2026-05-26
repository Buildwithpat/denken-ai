/**
 * Explanation Service
 *
 * Serves AI-generated explanations for QuestionBank questions.
 * Uses QuestionExplanation as a cache layer with MongoDB TTL.
 * All generation is delegated to the Python AI service (Gemini 1.5 Flash).
 */

import QuestionExplanation, {
  type ExplanationStyle,
  type IQuestionExplanation,
} from '../models/QuestionExplanation';
import QuestionBank from '../models/QuestionBank';
import { AppError } from '../utils/AppError';

const AI_SERVICE_URL = process.env.AI_SERVICE_URL ?? 'http://localhost:8000';
const CACHE_TTL_MS   = 7 * 24 * 60 * 60 * 1000; // 7 days

// ── Main entry point ──────────────────────────────────────────────────────────

export async function getExplanation(
  stableId: string,
  style:    ExplanationStyle,
  mistakeType?: string,
): Promise<IQuestionExplanation> {
  // 1. Cache hit
  const cached = await QuestionExplanation.findOne({ stableId, style }).lean();
  if (cached && cached.expiresAt > new Date()) {
    return cached as IQuestionExplanation;
  }

  // 2. Fetch question metadata
  const question = await QuestionBank.findOne({ stableId, isActive: true }).lean();
  if (!question) throw new AppError('Question not found.', 404);

  // 3. Generate via Python AI service
  const generated = await callAiExplain({
    stableId,
    style,
    questionText:    question.questionText,
    options:         question.options,
    correctOption:   question.correctOption,
    answer:          question.answer,
    type:            question.type,
    subject:         question.subject,
    chapter:         question.chapter,
    topic:           question.topic,
    conceptTags:     question.conceptTags,
    formulaTags:     question.formulaTags,
    bloomLevel:      question.bloomLevel,
    learningObjective: question.learningObjective,
    mistakeType,
  });

  // 4. Upsert cache (replace expired or missing)
  const expiresAt = new Date(Date.now() + CACHE_TTL_MS);
  const doc = await QuestionExplanation.findOneAndUpdate(
    { stableId, style },
    {
      $set: {
        ...generated,
        questionVersion: question.version ?? 1,
        expiresAt,
        generatedBy: 'gemini',
      },
    },
    { upsert: true, new: true, runValidators: false },
  );

  return doc!.toObject() as IQuestionExplanation;
}

// ── Progressive hints only ────────────────────────────────────────────────────

export async function getHints(
  stableId:  string,
  hintLevel: 1 | 2 | 3,
): Promise<string[]> {
  const explanation = await getExplanation(stableId, 'step-by-step');
  const hints = explanation.hintsProgressive ?? [];
  return hints.slice(0, hintLevel);
}

// ── Batch warm-up (called after new questions are ingested) ───────────────────

export async function warmExplanationCache(stableIds: string[]): Promise<void> {
  const STYLES: ExplanationStyle[] = ['step-by-step', 'mistake-aware'];
  for (const stableId of stableIds) {
    for (const style of STYLES) {
      try {
        await getExplanation(stableId, style);
      } catch {
        // Best-effort — don't fail ingestion if explanation generation fails
      }
    }
  }
}

// ── AI service call ───────────────────────────────────────────────────────────

interface AiExplainPayload {
  stableId:          string;
  style:             ExplanationStyle;
  questionText:      string;
  options?:          string[];
  correctOption?:    string;
  answer?:           number;
  type:              string;
  subject:           string;
  chapter:           string;
  topic:             string;
  conceptTags?:      string[];
  formulaTags?:      string[];
  bloomLevel?:       string;
  learningObjective?: string;
  mistakeType?:      string;
}

interface AiExplainResponse {
  explanation:       string;
  stepByStep:        string[];
  keyInsight:        string;
  commonMistakes:    string[];
  hintsProgressive:  string[];
  alternativeMethod?: string;
  formulasUsed:      string[];
}

async function callAiExplain(payload: AiExplainPayload): Promise<AiExplainResponse> {
  const res = await fetch(`${AI_SERVICE_URL}/questions/explain`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
    signal:  AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => 'unknown');
    throw new AppError(`AI service explanation failed: ${err}`, 502);
  }

  return res.json() as Promise<AiExplainResponse>;
}
