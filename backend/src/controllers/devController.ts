import { Response } from 'express';
import type { AuthRequest } from '../middleware/auth';
import User from '../models/User';
import { computeEntitlements } from '../lib/entitlements';
import { env } from '../config/env';
import { buildGroundingContext, serializeForPrompt } from '../lib/groundingContext';
import { getRepresentativePYQs, formatPYQsForPrompt } from '../lib/pyqRetrieval';
import { generateGroundedQuestions } from '../services/geminiQuestionGenerator';
import { generateTest } from '../services/testGenerator';
import { getQuestionBankExamples, getBankTopicHints } from '../lib/questionBankGrounding';
import {
  getChapterIntelligence,
  getTopChapters,
  getHighROIChapters,
  getCrashCourseChapters,
  getChaptersByTag,
  formatIntelligenceForPrompt,
} from '../lib/importantTopicsLoader';
import type { ExamKey, AdaptiveMode } from '../types';

// ── Guard ─────────────────────────────────────────────────────────────────────

function isDevMode(): boolean {
  return env.DEV_MODE;
}

// ── Persona catalog ───────────────────────────────────────────────────────────

export const PERSONA_IDS = [
  'fresh-user',
  'free-demo',
  'free-exhausted',
  'pro-active',
  'pro-grace',
  'pro-expired',
] as const;

export type PersonaId = typeof PERSONA_IDS[number];

const PERSONAS: Record<PersonaId, { label: string; description: string }> = {
  'fresh-user':     { label: 'Fresh User',      description: 'New account — onboarding incomplete, no quota used' },
  'free-demo':      { label: 'Free / Demo',      description: 'Onboarded free user — 0 of 1 test + 0 of 1 revision used' },
  'free-exhausted': { label: 'Free Exhausted',   description: 'Free user who has used all demo quota (1/1 test + 1/1 revision)' },
  'pro-active':     { label: 'Pro Active',       description: 'Active pro subscription with 30 days remaining' },
  'pro-grace':      { label: 'Pro Grace Period', description: 'Pro subscription ended 1 day ago — still within 3-day grace window' },
  'pro-expired':    { label: 'Pro Expired',      description: 'Pro subscription ended 4 days ago — past the grace period' },
};

// ── Persona update builder ────────────────────────────────────────────────────
// Returns a fully-specified Mongoose update object for each persona.
// Using a function avoids the "used before assignment" pattern that confuses
// TypeScript strict-mode definite-assignment analysis.

function buildPersonaUpdate(persona: PersonaId): Record<string, unknown> {
  const now = new Date();

  switch (persona) {
    case 'fresh-user':
      return {
        onboardingComplete:    false,
        plan:                  'free',
        subscriptionStatus:    'none',
        testsUsed:             0,
        revisionsUsed:         0,
        subscriptionEndsAt:    null,
        subscriptionStartedAt: null,
      };

    case 'free-demo':
      return {
        onboardingComplete:    true,
        plan:                  'free',
        subscriptionStatus:    'none',
        testsUsed:             0,
        revisionsUsed:         0,
        subscriptionEndsAt:    null,
        subscriptionStartedAt: null,
      };

    case 'free-exhausted':
      return {
        onboardingComplete:    true,
        plan:                  'free',
        subscriptionStatus:    'none',
        testsUsed:             1,
        revisionsUsed:         1,
        subscriptionEndsAt:    null,
        subscriptionStartedAt: null,
      };

    case 'pro-active':
      return {
        onboardingComplete:    true,
        plan:                  'pro',
        subscriptionStatus:    'active',
        testsUsed:             3,
        revisionsUsed:         2,
        subscriptionEndsAt:    new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
        subscriptionStartedAt: now,
      };

    case 'pro-grace':
      return {
        onboardingComplete:    true,
        plan:                  'pro',
        subscriptionStatus:    'grace_period',
        testsUsed:             5,
        revisionsUsed:         3,
        subscriptionEndsAt:    new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
        subscriptionStartedAt: new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000),
      };

    case 'pro-expired':
      return {
        onboardingComplete:    true,
        plan:                  'pro',
        subscriptionStatus:    'expired',
        testsUsed:             8,
        revisionsUsed:         5,
        subscriptionEndsAt:    new Date(now.getTime() - 4 * 24 * 60 * 60 * 1000),
        subscriptionStartedAt: new Date(now.getTime() - 34 * 24 * 60 * 60 * 1000),
      };
  }
}

// ── Handlers ──────────────────────────────────────────────────────────────────

// ── Grounded generation debug ─────────────────────────────────────────────────

/**
 * POST /api/dev/grounded-generate
 *
 * Manually trigger the PYQ-grounded generation pipeline and return the full
 * debug output — which PYQs were selected, which formulas were injected,
 * what Gemini produced, and the final question set.
 *
 * Request body:
 *   { exam, subject, chapter, topic?, type?, count?, difficulty?, showPrompt? }
 *
 * Response:
 *   { groundingDebug, questions, generationSource, promptPreview? }
 */
export async function groundedGenerateDebugHandler(req: AuthRequest, res: Response): Promise<void> {
  if (!isDevMode()) {
    res.status(403).json({ error: 'Dev endpoints are disabled in production.' });
    return;
  }

  const {
    exam       = 'JEE_MAIN',
    subject    = 'Physics',
    chapter    = 'Gravitation',
    topic,
    type       = 'mcq',
    count      = 3,
    difficulty = 'mixed',
    showPrompt = false,
  } = req.body as {
    exam?: string;
    subject?: string;
    chapter?: string;
    topic?: string;
    type?: 'mcq' | 'numerical';
    count?: number;
    difficulty?: string;
    showPrompt?: boolean;
  };

  try {
    // 1. Build grounding context
    const groundingCtx = await buildGroundingContext({
      exam, subject, chapter: chapter, topic,
      pyqLimit:    5,
      formulaLimit: 10,
    });

    const promptText = serializeForPrompt(groundingCtx);

    // 2. Generate questions using grounded pipeline
    const genResult = await generateGroundedQuestions({
      exam,
      subject,
      topic: topic ?? chapter,
      topicType: 'chapter',
      difficulty,
      type,
      count: Math.min(count, 10),
      correctMarks: 4,
    });

    // 3. PYQ retrieval debug (separate call for detailed display)
    const pyqDebug = getRepresentativePYQs(exam, subject, chapter, topic, 5);

    res.status(200).json({
      request:          { exam, subject, chapter, topic, type, count, difficulty },
      groundingDebug:   groundingCtx.debugLog,
      pyqsRetrieved:    pyqDebug.questions,
      pyqRetrievalLog:  pyqDebug.debugLog,
      generationSource: genResult.source,
      generationDebug:  genResult.debugLog,
      questions:        genResult.questions,
      promptPreview:    showPrompt ? promptText : '(set showPrompt:true to see full prompt)',
    });
  } catch (err) {
    res.status(500).json({
      error: 'Grounded generation debug failed',
      detail: (err as Error).message,
    });
  }
}

/**
 * POST /api/dev/grounded-full-test
 *
 * Generate a complete mock test using the PYQ-grounded pipeline and return
 * the full test plus per-slot debug information. Use this to verify end-to-end
 * quality before publishing features to users.
 *
 * Request body:
 *   { exam, subjects?, chapters?, questionCount?, difficulty? }
 */
export async function groundedFullTestDebugHandler(req: AuthRequest, res: Response): Promise<void> {
  if (!isDevMode()) {
    res.status(403).json({ error: 'Dev endpoints are disabled in production.' });
    return;
  }

  const {
    exam          = 'JEE_MAIN',
    subjects      = ['Physics', 'Chemistry', 'Mathematics'],
    chapters,
    questionCount = 10,
    difficulty    = 'mixed',
  } = req.body as {
    exam?: string;
    subjects?: string[];
    chapters?: string[];
    questionCount?: number;
    difficulty?: string;
  };

  try {
    const t0 = Date.now();

    const generatedTest = await generateTest({
      exam:          exam as ExamKey,
      subjects,
      chapters,
      difficulty:    difficulty as 'easy' | 'medium' | 'hard' | 'mixed',
      questionCount: Math.min(questionCount, 30),
    });

    const latencyMs = Date.now() - t0;

    // Annotate each question with its generation source
    const sourceBreakdown = {
      fromBank:         generatedTest.questions.filter(q => q.bankQuestionId).length,
      geminiGrounded:   generatedTest.questions.filter(q => !q.bankQuestionId && (q.conceptTags?.length ?? 0) > 0).length,
      templateFallback: generatedTest.questions.filter(q => !q.bankQuestionId && (q.conceptTags?.length ?? 0) === 0).length,
    };

    res.status(200).json({
      request: { exam, subjects, chapters, questionCount, difficulty },
      test: {
        totalQuestions: generatedTest.totalQuestions,
        duration:       generatedTest.duration,
        marking:        generatedTest.marking,
        subjects:       generatedTest.subjects,
        generatedAt:    generatedTest.generatedAt,
      },
      sourceBreakdown,
      latencyMs,
      questions: generatedTest.questions,
    });
  } catch (err) {
    res.status(500).json({
      error:  'Full test generation failed',
      detail: (err as Error).message,
    });
  }
}

/**
 * GET /api/dev/important-topics?exam=JEE_MAIN&subject=Physics
 *
 * Returns the raw important-topics intelligence for an exam/subject,
 * sorted by priority. Useful for verifying the dataset and ROI ordering.
 */
export function importantTopicsDebugHandler(req: AuthRequest, res: Response): void {
  if (!isDevMode()) {
    res.status(403).json({ error: 'Dev endpoints are disabled in production.' });
    return;
  }

  const exam    = (req.query.exam    as string) ?? 'JEE_MAIN';
  const subject = req.query.subject  as string | undefined;
  const mode    = (req.query.mode    as string) ?? 'top';  // top | high-roi | crash-course | tag
  const tag     = req.query.tag      as string | undefined;
  const topN    = parseInt((req.query.topN as string) ?? '10', 10);

  let chapters;
  switch (mode) {
    case 'high-roi':
      chapters = getHighROIChapters(exam, subject, 4, topN);
      break;
    case 'crash-course':
      chapters = getCrashCourseChapters(exam, subject, topN);
      break;
    case 'tag':
      chapters = getChaptersByTag(exam, tag ? tag.split(',') : ['easy-win'], subject);
      break;
    default:
      chapters = getTopChapters(exam, subject, topN);
  }

  res.status(200).json({
    request: { exam, subject, mode, tag, topN },
    count:   chapters.length,
    chapters: chapters.map(c => ({
      ...c,
      promptFormat: formatIntelligenceForPrompt(c),
    })),
  });
}

/**
 * POST /api/dev/chapter-intelligence
 *
 * Returns the full intelligence profile for a single chapter,
 * including what would be injected into Gemini grounding prompts.
 *
 * Request body:
 *   { exam, subject, chapter }
 */
export function chapterIntelligenceDebugHandler(req: AuthRequest, res: Response): void {
  if (!isDevMode()) {
    res.status(403).json({ error: 'Dev endpoints are disabled in production.' });
    return;
  }

  const { exam = 'JEE_MAIN', subject, chapter } = req.body as {
    exam?: string;
    subject?: string;
    chapter?: string;
  };

  if (!subject || !chapter) {
    res.status(400).json({ error: 'subject and chapter are required.' });
    return;
  }

  const intel = getChapterIntelligence(exam, subject, chapter);

  if (!intel) {
    res.status(200).json({
      found: false,
      request: { exam, subject, chapter },
      message: 'No important-topics entry found for this chapter. Check spelling or try a broader chapter name.',
    });
    return;
  }

  res.status(200).json({
    found: true,
    request: { exam, subject, chapter },
    intelligence: intel,
    promptFormat: formatIntelligenceForPrompt(intel),
  });
}

/**
 * POST /api/dev/intelligent-test
 *
 * Generate a mock test using a specific adaptive mode that leverages
 * important-topics data (high-roi, crash-course, formula-heavy).
 * Returns test + debug info showing how important-topics influenced topic selection.
 *
 * Request body:
 *   { exam, subjects?, questionCount?, adaptiveMode }
 */
export async function intelligentTestDebugHandler(req: AuthRequest, res: Response): Promise<void> {
  if (!isDevMode()) {
    res.status(403).json({ error: 'Dev endpoints are disabled in production.' });
    return;
  }

  const {
    exam          = 'JEE_MAIN',
    subjects      = ['Physics', 'Chemistry', 'Mathematics'],
    questionCount = 10,
    adaptiveMode  = 'high-roi',
  } = req.body as {
    exam?:         string;
    subjects?:     string[];
    questionCount?: number;
    adaptiveMode?: string;
  };

  const VALID_MODES: AdaptiveMode[] = ['high-roi', 'crash-course', 'formula-heavy', 'weak-topic', 'revision'];
  if (!VALID_MODES.includes(adaptiveMode as AdaptiveMode)) {
    res.status(400).json({
      error: `adaptiveMode must be one of: ${VALID_MODES.join(', ')}`,
    });
    return;
  }

  try {
    const t0 = Date.now();

    // Show what chapters this mode would prioritise for each subject
    const chapterIntelDebug: Record<string, unknown> = {};
    for (const subject of subjects) {
      let prioritised;
      switch (adaptiveMode) {
        case 'high-roi':
          prioritised = getHighROIChapters(exam, subject, 4, 5).map(c => ({
            chapter: c.chapter,
            weightageScore: c.weightageScore,
            frequencyScore: c.frequencyScore,
            revisionValue: c.revisionValue,
          }));
          break;
        case 'crash-course':
          prioritised = getCrashCourseChapters(exam, subject, 5).map(c => ({
            chapter: c.chapter,
            revisionValue: c.revisionValue,
            difficultyScore: c.difficultyScore,
          }));
          break;
        case 'formula-heavy':
          prioritised = getChaptersByTag(exam, ['formula-heavy', 'numerical-based'], subject).slice(0, 5).map(c => ({
            chapter: c.chapter,
            tags: c.tags,
          }));
          break;
        default:
          prioritised = getTopChapters(exam, subject, 5).map(c => ({ chapter: c.chapter, priority: c.priority }));
      }
      chapterIntelDebug[subject] = prioritised;
    }

    const generatedTest = await generateTest({
      exam:          exam as ExamKey,
      subjects,
      difficulty:    'mixed',
      questionCount: Math.min(questionCount, 20),
      adaptiveMode:  adaptiveMode as AdaptiveMode,
      topicWeights:  new Map(), // empty — mode logic uses important-topics instead
    });

    const latencyMs = Date.now() - t0;

    res.status(200).json({
      request: { exam, subjects, questionCount, adaptiveMode },
      chapterIntelligenceUsed: chapterIntelDebug,
      test: {
        totalQuestions: generatedTest.totalQuestions,
        duration:       generatedTest.duration,
        subjects:       generatedTest.subjects,
        generatedAt:    generatedTest.generatedAt,
      },
      topicDistribution: generatedTest.questions.reduce<Record<string, number>>((acc, q) => {
        acc[q.topic] = (acc[q.topic] ?? 0) + 1;
        return acc;
      }, {}),
      latencyMs,
      questions: generatedTest.questions,
    });
  } catch (err) {
    res.status(500).json({
      error:  'Intelligent test generation failed',
      detail: (err as Error).message,
    });
  }
}

/**
 * POST /api/dev/bank-grounding
 *
 * Inspect what question-bank examples would be injected for a given exam/subject/chapter.
 * Shows the exact text that goes into Gemini prompts from the question-bank layer.
 *
 * Request body: { exam, subject, chapter, limit? }
 */
export function bankGroundingDebugHandler(req: AuthRequest, res: Response): void {
  if (!isDevMode()) {
    res.status(403).json({ error: 'Dev endpoints are disabled in production.' });
    return;
  }

  const { exam = 'JEE_MAIN', subject, chapter, limit = 4 } = req.body as {
    exam?:    string;
    subject?: string;
    chapter?: string;
    limit?:   number;
  };

  if (!subject || !chapter) {
    res.status(400).json({ error: 'subject and chapter are required.' });
    return;
  }

  try {
    const t0     = Date.now();
    const result = getQuestionBankExamples(exam, subject, chapter, limit);
    const hints  = getBankTopicHints(exam, subject);

    res.status(200).json({
      request:        { exam, subject, chapter, limit },
      loadTimeMs:     Date.now() - t0,
      debugLog:       result.debugLog,
      topicHints:     hints,
      formattedPromptBlock: result.formatted,
      examples:       result.examples,
    });
  } catch (err) {
    res.status(500).json({
      error:  'Bank grounding debug failed',
      detail: (err as Error).message,
    });
  }
}

/**
 * POST /api/dev/full-grounding
 *
 * Returns the complete grounding context that would be injected for a chapter —
 * bank examples + PYQs + formulas + syllabus + important-topics intelligence.
 * This is the full picture of what Gemini sees before generating questions.
 *
 * Request body: { exam, subject, chapter, topic? }
 */
export async function fullGroundingDebugHandler(req: AuthRequest, res: Response): Promise<void> {
  if (!isDevMode()) {
    res.status(403).json({ error: 'Dev endpoints are disabled in production.' });
    return;
  }

  const { exam = 'JEE_MAIN', subject, chapter, topic } = req.body as {
    exam?:    string;
    subject?: string;
    chapter?: string;
    topic?:   string;
  };

  if (!subject || !chapter) {
    res.status(400).json({ error: 'subject and chapter are required.' });
    return;
  }

  try {
    const t0 = Date.now();

    // Bank grounding
    const bankResult = getQuestionBankExamples(exam, subject, chapter, 4);

    // PYQ + formula + syllabus + intelligence grounding
    const groundingCtx = await buildGroundingContext({
      exam, subject, chapter, topic,
      pyqLimit: 3, formulaLimit: 6,
    });
    const groundingText = serializeForPrompt(groundingCtx);

    // Simulate what Gemini prompt would look like
    const fullPromptPreview = [
      bankResult.formatted,
      groundingText,
    ].join('\n');

    res.status(200).json({
      request:        { exam, subject, chapter, topic },
      totalTimeMs:    Date.now() - t0,
      tokenEstimate:  Math.round(fullPromptPreview.length / 4),
      bankGrounding:  {
        debugLog:  bankResult.debugLog,
        formatted: bankResult.formatted,
      },
      pyqGrounding: {
        debugLog: groundingCtx.debugLog,
        formatted: groundingText,
      },
      fullPromptPreview,
    });
  } catch (err) {
    res.status(500).json({
      error:  'Full grounding debug failed',
      detail: (err as Error).message,
    });
  }
}

export function listPersonasHandler(_req: AuthRequest, res: Response): void {
  if (!isDevMode()) {
    res.status(403).json({ error: 'Dev endpoints are disabled in production.' });
    return;
  }

  const personas = PERSONA_IDS.map((id) => ({ id, ...PERSONAS[id] }));
  res.status(200).json({ personas });
}

export async function setPersonaHandler(req: AuthRequest, res: Response): Promise<void> {
  if (!isDevMode()) {
    res.status(403).json({ error: 'Dev endpoints are disabled in production.' });
    return;
  }

  const { persona } = req.body as { persona?: string };

  if (!persona || !(PERSONA_IDS as readonly string[]).includes(persona)) {
    res.status(400).json({
      error:   `Invalid persona. Valid options: ${PERSONA_IDS.join(', ')}`,
      options: PERSONA_IDS,
    });
    return;
  }

  const userId = req.user!.userId;
  const update = buildPersonaUpdate(persona as PersonaId);

  try {
    const user = await User.findByIdAndUpdate(userId, update, { new: true });
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const entitlements = computeEntitlements({
      plan:                  user.plan,
      subscriptionStatus:    user.subscriptionStatus,
      testsUsed:             user.testsUsed,
      revisionsUsed:         user.revisionsUsed,
      subscriptionEndsAt:    user.subscriptionEndsAt,
      subscriptionStartedAt: user.subscriptionStartedAt,
    });

    res.status(200).json({
      persona,
      message: `Persona '${persona}' applied successfully.`,
      user: {
        id:                 user._id.toString(),
        name:               user.name,
        email:              user.email,
        mobileNumber:       user.mobileNumber,
        avatar:             user.avatar ?? '',
        targetExam:         user.targetExam,
        onboardingComplete: user.onboardingComplete,
      },
      entitlements,
    });
  } catch {
    res.status(500).json({ error: 'Failed to apply dev persona.' });
  }
}
