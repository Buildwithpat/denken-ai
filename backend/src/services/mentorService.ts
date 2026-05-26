/**
 * Mentor Service — assembles the full StudentContext from MongoDB analytics
 * and sends it to the Python AI service for personalized mentor responses.
 *
 * This is the "context assembly" layer:
 *  - Topic weights (mastery, retention, forgetting) from computeTopicWeights()
 *  - Mistake patterns from MistakePattern model
 *  - Roadmap phase + priority chapters from roadmapService
 *  - Formula context from formulaLoader (for formula-aware responses)
 *  - Long-term memory from MentorSession model
 *
 * The assembled StudentContext is sent to Python with every mentor request,
 * giving the AI full visibility into the student's preparation state without
 * Python needing direct MongoDB access.
 */

import { Types } from 'mongoose';
import { computeTopicWeights }    from './topicWeightService';
import MistakePattern, { IMistakePatternDocument } from '../models/MistakePattern';
import MentorSession, { type IMessage, type IWeakness } from '../models/MentorSession';
import { getExamRoadmap }         from './roadmapService';
import { extractFormulaStrings }  from '../lib/formulaLoader';
import { buildGroundingContext, serializeForPrompt } from '../lib/groundingContext';
import { getChapterIntelligence, formatIntelligenceForPrompt } from '../lib/importantTopicsLoader';
import { aiServiceClient, type StudentContextPayload, type MentorChatRequest, type MentorResponse } from '../lib/aiServiceClient';
import User                       from '../models/User';
import { resolveExamMeta, toISODate } from '../lib/studyUtils';
import { logger }                 from '../lib/logger';

// ── Allowed values ────────────────────────────────────────────────────────────

const ALLOWED_EXAMS = new Set(['JEE_MAIN', 'JEE_ADVANCED', 'NEET', 'CBSE']);

// ── Subject slug mapping ──────────────────────────────────────────────────────

const SUBJECT_SLUG: Record<string, string> = {
  Physics:     'physics',
  Chemistry:   'chemistry',
  Mathematics: 'maths',
  Biology:     'biology',
};

// ── Context assembly ──────────────────────────────────────────────────────────

export async function buildStudentContext(
  userId: string,
  chapter: string | null,
  subject: string | null,
  exam:    string,
): Promise<StudentContextPayload> {
  const uid = new Types.ObjectId(userId);

  // Parallel: topic weights + mistake patterns + roadmap + user profile
  const [topicWeights, mistakePatterns, roadmap, user] = await Promise.all([
    computeTopicWeights(userId),
    MistakePattern.find({ userId: uid }).sort({ totalMistakes: -1 }).lean<IMistakePatternDocument[]>(),
    getExamRoadmap(userId, exam).catch(() => null),
    User.findById(uid).select('targetExam targetYear').lean(),
  ]);

  // Mastery items (from topic weights map)
  const mastery: StudentContextPayload['mastery'] = [];
  topicWeights.forEach((tw, topic) => {
    mastery.push({
      topic,
      subject:           tw.subject,
      mastery_score:     tw.masteryScore,
      retention_score:   tw.retentionScore,
      forgetting_factor: tw.forgettingFactor,
      error_rate:        Math.round(tw.errorRate * 100) / 100,
      days_since_seen:   tw.daysSinceLastSeen,
      recent_wrong:      tw.recentWrong,
    });
  });

  // Sort mastery by mastery_score ASC (weakest first) for context relevance
  mastery.sort((a, b) => a.mastery_score - b.mastery_score);

  // Mistake items
  const mistakes: StudentContextPayload['mistakes'] = mistakePatterns.map((p) => ({
    topic:               p.topic,
    subject:             p.subject,
    dominant_type:       p.dominantType,
    total_mistakes:      p.totalMistakes,
    consecutive_wrong:   p.consecutiveWrong,
    recent_mistakes:     p.recentMistakes,
    insight:             p.insight,
    linked_formula_slug: p.linkedFormulaChapterSlug,
    linked_subject_slug: p.linkedSubjectSlug,
  }));

  // Roadmap context
  const phase = roadmap?.phase ?? 'foundation-building';
  const priorityChapters = roadmap?.subjectTracks
    .flatMap((t) => t.chapters.filter((c) => c.priority === 'critical' || c.priority === 'high'))
    .sort((a, b) => b.roiScore - a.roiScore)
    .slice(0, 5)
    .map((c) => c.chapter) ?? [];
  const todayFocus = roadmap?.dailyMission.focusSummary ?? '';
  const daysToExam = roadmap?.daysToExam ?? null;
  const syllabusProgress = roadmap?.syllabusProgress ?? 0;

  // Formula context for the specific chapter/subject (pre-fetch for AI)
  let formulaContext: string[] = [];
  if (chapter && subject) {
    const slug = SUBJECT_SLUG[subject] ?? subject.toLowerCase();
    formulaContext = extractFormulaStrings(slug, chapter).slice(0, 8);
  }

  return {
    user_id:           userId,
    exam,
    phase,
    mastery,
    mistakes,
    priority_chapters: priorityChapters,
    today_focus:       todayFocus,
    days_to_exam:      daysToExam,
    syllabus_progress: syllabusProgress,
    formula_context:   formulaContext,
  };
}

// ── Session management ────────────────────────────────────────────────────────

const MESSAGE_WINDOW = 20; // keep last N messages

async function saveToSession(
  userId: string,
  userMsg: string,
  assistantMsg: string,
  intent: string,
  chapter: string | null,
  subject: string | null,
  mistakeTopics: string[],
  mistakeTypes: string[],
): Promise<void> {
  const uid = new Types.ObjectId(userId);

  const userMessage: IMessage = {
    role: 'user', content: userMsg, intent,
    chapter: chapter ?? null, subject: subject ?? null, createdAt: new Date(),
  };
  const assistantMessage: IMessage = {
    role: 'assistant', content: assistantMsg.slice(0, 2000), intent,
    chapter: chapter ?? null, subject: subject ?? null, createdAt: new Date(),
  };

  // Build weakness updates
  const now = new Date();
  const weaknessUpdates: IWeakness[] = mistakeTopics.map((topic, i) => ({
    topic, subject: subject ?? 'Unknown', mistakeType: mistakeTypes[i] ?? 'conceptual',
    firstSeenAt: now, lastSeenAt: now, occurrences: 1, aiInsight: '',
  }));

  await MentorSession.findOneAndUpdate(
    { userId: uid },
    {
      $push: {
        messages: {
          $each: [userMessage, assistantMessage],
          $slice: -MESSAGE_WINDOW,
        },
      },
      $inc:  { totalInteractions: 1 },
      $set:  { lastActiveAt: now },
      ...(weaknessUpdates.length > 0 ? {
        $addToSet: { identifiedWeaknesses: { $each: weaknessUpdates } },
      } : {}),
    },
    { upsert: true, new: true },
  );
}

export async function getSession(userId: string) {
  const uid = new Types.ObjectId(userId);
  const session = await MentorSession.findOne({ userId: uid }).lean();
  if (!session) return { messages: [], identifiedWeaknesses: [], totalInteractions: 0 };
  return {
    messages:             session.messages.slice(-10), // last 10 for display
    identifiedWeaknesses: session.identifiedWeaknesses.slice(0, 8),
    totalInteractions:    session.totalInteractions,
  };
}

// ── Main chat function ────────────────────────────────────────────────────────

export async function mentorChat(
  userId:  string,
  message: string,
  chapter: string | null,
  subject: string | null,
  exam:    string,
  intent:  string | null,
): Promise<MentorResponse> {
  const safeExam = ALLOWED_EXAMS.has(exam) ? exam : 'JEE_MAIN';

  // Assemble full student context
  const studentContext = await buildStudentContext(userId, chapter, subject, safeExam);

  // Build PYQ grounding context when chapter/subject are known
  let pyqContext:     string | undefined;
  let syllabusCtx:   string[] | undefined;

  if (chapter && subject) {
    try {
      const groundingCtx = await buildGroundingContext({
        exam:        safeExam,
        subject:     subject,
        chapter:     chapter,
        pyqLimit:    3,
        formulaLimit: 5,
      });
      pyqContext   = serializeForPrompt(groundingCtx);
      syllabusCtx  = groundingCtx.syllabusUnits;
      logger.info('[mentorService] Grounding injected', {
        chapter, subject,
        pyqsSelected:          groundingCtx.debugLog.pyqsSelected,
        pyqSources:            groundingCtx.debugLog.pyqSources,
        importantTopicFound:   groundingCtx.debugLog.importantTopicFound,
        importantTopicPriority: groundingCtx.debugLog.importantTopicPriority,
      });
    } catch (err) {
      logger.warn('[mentorService] Grounding context build failed (non-fatal)', { chapter, subject, err });
    }

    // Inject important-topics intelligence even if grounding context build fails
    if (!pyqContext) {
      try {
        const intel = getChapterIntelligence(safeExam, subject, chapter);
        if (intel) {
          pyqContext = '=== CHAPTER STRATEGIC INTELLIGENCE ===\n' + formatIntelligenceForPrompt(intel);
        }
      } catch (err) {
        logger.warn('[mentorService] Chapter intelligence load failed (non-fatal)', { chapter, subject, err });
      }
    }
  }

  const req: MentorChatRequest = {
    message,
    chapter,
    subject,
    student_context: studentContext,
    intent,
    pyq_context:     pyqContext,
    syllabus_context: syllabusCtx,
  };

  // Call Python AI service
  logger.info('[mentorService] Calling AI service', { userId, intent: intent ?? 'auto', subject: subject ?? 'any' });
  const response = await aiServiceClient.mentorChat(req, userId);

  if (!response) {
    logger.warn('[mentorService] AI service returned null — serving fallback response', { userId });
    return {
      answer: (
        "I'm temporarily unable to connect to the AI service. " +
        "Your study data is safe — please try again in a moment.\n\n" +
        "While you wait: check your **Roadmap** for priority chapters " +
        "and your **Revision** queue for today's focus."
      ),
      key_points:      [],
      related_topics:  [],
      formula_refs:    [],
      suggestions:     ['Check Roadmap → /roadmap', 'Start Revision → /revision'],
      generated_by:    'fallback',
      rag_chunks_used: 0,
      intent_detected: intent ?? 'explain',
    };
  }

  // Persist to long-term memory (fire-and-forget)
  const mistakeTopics = studentContext.mistakes.map((m) => m.topic);
  const mistakeTypes  = studentContext.mistakes.map((m) => m.dominant_type);
  void saveToSession(
    userId, message, response.answer,
    response.intent_detected, chapter, subject,
    mistakeTopics.slice(0, 3), mistakeTypes.slice(0, 3),
  );

  return response;
}

// ── Formula ingestion trigger ─────────────────────────────────────────────────

export async function triggerFormulaIngestion(
  subject: string,
  exam: string = 'JEE_MAIN',
  replace: boolean = false,
): Promise<{ ingested: number; skipped: number; chapters: number; errors: string[] }> {
  const { getChapters, getChapter } = await import('../lib/formulaLoader');
  const slug = SUBJECT_SLUG[subject] ?? subject.toLowerCase();

  const summaries = getChapters(slug, exam);
  if (summaries.length === 0) {
    return { ingested: 0, skipped: 0, chapters: 0, errors: [`No chapters found for ${subject}`] };
  }

  // Load full chapter details (with concepts + formulas)
  const chapters = summaries
    .map((s) => getChapter(slug, s.slug))
    .filter(Boolean);

  const result = await aiServiceClient.ingestFormulas({
    chapters,
    subject_slug: slug,
    exam,
    replace,
  });

  return result ?? { ingested: 0, skipped: chapters.length, chapters: chapters.length, errors: ['AI service unavailable'] };
}
