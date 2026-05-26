/**
 * Typed HTTP client for the FastAPI AI service.
 *
 * Production hardening added:
 *  - Circuit breaker: opens after 5 consecutive failures, retries after 60s
 *  - Retry with exponential backoff (up to 2 retries for transient errors)
 *  - AI usage tracking (tokens, latency, cost estimate, cache hit/miss)
 *  - Response caching for explanation and concept-guidance endpoints
 *  - Graceful null return on all failures so callers can fall back
 */

import { env }                                from '../config/env';
import { cacheGet, cacheSet, CacheKey, TTL }  from './cache';
import { trackAICall }                        from './aiTracker';
import { isCircuitOpen, recordSuccess, recordFailure } from './circuitBreaker';
import { logger }                             from './logger';
import crypto                                 from 'crypto';

const BASE            = env.AI_SERVICE_URL;
const DEFAULT_TIMEOUT = 10_000;
const MENTOR_TIMEOUT  = 45_000;
const MAX_RETRIES     = 2;

// ── Internal HTTP helper ──────────────────────────────────────────────────────

async function postWithRetry<TReq, TRes>(
  path:     string,
  body:     TReq,
  timeout:  number,
  userId:   string,
  useCache: false | { key: string; ttl: number },
): Promise<TRes | null> {
  // 1. Cache check
  if (useCache) {
    const cached = await cacheGet<TRes>(useCache.key);
    if (cached) {
      void trackAICall({ userId, endpoint: path, latencyMs: 0, cacheHit: true });
      return cached;
    }
  }

  // 2. Circuit breaker check
  if (await isCircuitOpen(path)) return null;

  const url = `${BASE}${path}`;
  let lastErr: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      // Exponential backoff: 500ms, 1000ms
      await new Promise(r => setTimeout(r, 500 * Math.pow(2, attempt - 1)));
    }

    const controller = new AbortController();
    const timer      = setTimeout(() => controller.abort(), timeout);
    const t0         = Date.now();

    try {
      const res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
        signal:  controller.signal,
      });

      clearTimeout(timer);
      const latencyMs = Date.now() - t0;

      if (!res.ok) {
        const text = await res.text().catch(() => '(unreadable)');
        logger.error('[AI-SERVICE] HTTP error', { path, status: res.status, text: text.slice(0, 200) });

        // 5xx → retryable; 4xx → not retryable
        if (res.status < 500) {
          void trackAICall({ userId, endpoint: path, latencyMs, cacheHit: false, error: `HTTP ${res.status}` });
          return null;
        }
        lastErr = new Error(`HTTP ${res.status}`);
        continue;
      }

      const data = (await res.json()) as TRes;

      await recordSuccess(path);
      void trackAICall({ userId, endpoint: path, requestBody: body, responseBody: data, latencyMs, cacheHit: false });

      // Cache successful response
      if (useCache) {
        void cacheSet(useCache.key, data, useCache.ttl);
      }

      return data;
    } catch (err) {
      clearTimeout(timer);
      const latencyMs = Date.now() - t0;
      lastErr = err as Error;

      if (lastErr.name === 'AbortError') {
        logger.error('[AI-SERVICE] Timeout', { path, timeout, attempt });
      } else if ((lastErr as NodeJS.ErrnoException).code === 'ECONNREFUSED') {
        logger.error('[AI-SERVICE] Connection refused', { path, base: BASE });
      } else {
        logger.error('[AI-SERVICE] Request failed', { path, err: lastErr.message, attempt });
      }

      if (attempt === MAX_RETRIES) {
        void trackAICall({ userId, endpoint: path, latencyMs, cacheHit: false, error: lastErr.message });
        await recordFailure(path);
      }
    }
  }

  return null;
}

// ── Cache key helpers ─────────────────────────────────────────────────────────

function hashBody(body: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex').slice(0, 16);
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AiNotesRequest {
  topic: string; subject: string; exam: string;
  depth: 'short' | 'medium' | 'detailed'; mode: 'theory' | 'formula' | 'both';
  /** PYQ-grounded context injected by groundingContext builder before sending to Gemini */
  pyq_context?: string;
  /** Syllabus units relevant to this topic */
  syllabus_context?: string[];
}
export interface AiNoteSection { heading: string; content: string; }
export interface AiNotesResponse {
  topic: string; subject: string; depth: string;
  sections: AiNoteSection[]; formulas: string[]; key_points: string[];
  generated_by: 'mock' | 'gemini' | 'openrouter';
}

export interface AiRevisionTopic { topic: string; subject: string; accuracy: number; }
export interface AiRevisionRequest {
  topics: AiRevisionTopic[]; exam: string;
  mode: 'drill' | 'concept' | 'practice'; question_count?: number;
  /** PYQ grounding context for revision topics — improves AI accuracy on what's exam-relevant */
  pyq_context?: string;
}
export interface AiRevisionPlanItem {
  day: string; topic: string; subject: string; duration: string; mode: string; focus_points: string[];
}
export interface AiRevisionResponse { plan: AiRevisionPlanItem[]; summary: string; generated_by: string; }

export interface AiPerfSubject   { subject: string; accuracy: number; trend: number; }
export interface AiPerfWeakTopic { topic: string; subject: string; accuracy: number; wrong_count: number; }
export interface AiPerfQType     { type: string; accuracy: number; }
export interface AiPerformanceRequest {
  exam: string; subjects: AiPerfSubject[]; weak_topics: AiPerfWeakTopic[];
  question_types: AiPerfQType[]; avg_accuracy: number; tests_taken: number;
}
export interface AiRecommendation { title: string; body: string; sentiment: 'success' | 'warning' | 'danger'; priority: number; }
export interface AiPerformanceResponse {
  summary: string; strengths: string[]; weaknesses: string[];
  recommendations: AiRecommendation[]; study_focus: string; generated_by: string;
}

export interface StudentMasteryItem {
  topic: string; subject: string; mastery_score: number; retention_score: number;
  forgetting_factor: number; error_rate: number; days_since_seen: number; recent_wrong: boolean;
}
export interface StudentMistakeItem {
  topic: string; subject: string; dominant_type: string; total_mistakes: number;
  consecutive_wrong: number; recent_mistakes: number; insight: string;
  linked_formula_slug: string | null; linked_subject_slug: string | null;
}
export interface StudentContextPayload {
  user_id: string; exam: string; phase: string;
  mastery: StudentMasteryItem[]; mistakes: StudentMistakeItem[];
  priority_chapters: string[]; today_focus: string;
  days_to_exam: number | null; syllabus_progress: number; formula_context: string[];
}
export interface MentorChatRequest {
  message: string; chapter: string | null; subject: string | null;
  student_context: StudentContextPayload; intent: string | null;
  /** PYQ examples for the discussed chapter — grounds mentor explanations in real exam style */
  pyq_context?: string;
  /** Syllabus units relevant to the current chapter */
  syllabus_context?: string[];
}
export interface MentorResponse {
  answer: string; key_points: string[]; related_topics: string[];
  formula_refs: string[]; suggestions: string[]; generated_by: string;
  rag_chunks_used: number; intent_detected: string;
}
export interface FormulaIngestPayload { chapters: unknown[]; subject_slug: string; exam: string; replace: boolean; }
export interface FormulaIngestResult { ingested: number; skipped: number; chapters: number; subject: string; errors: string[]; }

export interface ConceptGuidanceRequest {
  concept_name: string; subject: string; chapter: string; mastery_score: number;
  mistake_type?: string; formula_context?: string[]; student_context: StudentContextPayload;
  /** PYQ examples showing how this concept appears in real exams */
  pyq_context?: string;
}
export interface ConceptGuidanceResponse {
  guidance: string; key_formulas: string[]; common_errors: string[]; next_steps: string[]; generated_by: string;
}
export interface ConceptAssessRequest {
  concept_tag: string;
  responses: Array<{ question: string; isCorrect: boolean; solvingTimeSec: number }>;
  exam: string;
}
export interface ConceptAssessResponse {
  mastery_estimate: number; confidence: 'low' | 'medium' | 'high'; weak_areas: string[]; recommendation: string;
}

// ── Question explanation types ────────────────────────────────────────────────

export interface ExplanationRequest {
  stableId:    string;
  style:       string;
  mistakeType?: string;
  userId:      string;
}
export interface ExplanationResponse {
  explanation:    string;
  stepByStep:     string[];
  keyInsight:     string;
  commonMistakes: string[];
  formulasUsed:   string[];
  generated_by:   string;
}

// ── Public client ─────────────────────────────────────────────────────────────

export const aiServiceClient = {
  generateNotes: (req: AiNotesRequest, userId = 'system') =>
    postWithRetry<AiNotesRequest, AiNotesResponse>(
      '/generate-notes', req, DEFAULT_TIMEOUT, userId, false,
    ),

  generateRevision: (req: AiRevisionRequest, userId = 'system') =>
    postWithRetry<AiRevisionRequest, AiRevisionResponse>(
      '/generate-revision', req, DEFAULT_TIMEOUT, userId, false,
    ),

  analyzePerformance: (req: AiPerformanceRequest, userId = 'system') =>
    postWithRetry<AiPerformanceRequest, AiPerformanceResponse>(
      '/analyze-performance', req, DEFAULT_TIMEOUT, userId, false,
    ),

  mentorChat: (req: MentorChatRequest, userId: string) => {
    // Cache mentor responses keyed by userId + message hash + intent
    const cacheKey = CacheKey.mentorResponse(
      hashBody({ userId, msg: req.message, intent: req.intent, subject: req.subject }),
    );
    return postWithRetry<MentorChatRequest, MentorResponse>(
      '/mentor/chat', req, MENTOR_TIMEOUT, userId,
      { key: cacheKey, ttl: TTL.MENTOR_RESPONSE },
    );
  },

  ingestFormulas: (payload: FormulaIngestPayload, userId = 'system') =>
    postWithRetry<FormulaIngestPayload, FormulaIngestResult>(
      '/rag/ingest/formulas', payload, 30_000, userId, false,
    ),

  generateConceptGuidance: (req: ConceptGuidanceRequest, userId: string) => {
    const cacheKey = CacheKey.mentorResponse(
      hashBody({ userId, concept: req.concept_name, mastery: Math.floor(req.mastery_score / 10) * 10, mistake: req.mistake_type }),
    );
    return postWithRetry<ConceptGuidanceRequest, ConceptGuidanceResponse>(
      '/adaptive/concept-guidance', req, MENTOR_TIMEOUT, userId,
      { key: cacheKey, ttl: TTL.MENTOR_RESPONSE },
    );
  },

  assessConceptMastery: (req: ConceptAssessRequest, userId = 'system') =>
    postWithRetry<ConceptAssessRequest, ConceptAssessResponse>(
      '/adaptive/assess', req, DEFAULT_TIMEOUT, userId, false,
    ),

  generateExplanation: (req: ExplanationRequest) => {
    const cacheKey = CacheKey.explanation(req.stableId, req.style, req.mistakeType);
    return postWithRetry<ExplanationRequest, ExplanationResponse>(
      '/questions/explain', req, MENTOR_TIMEOUT, req.userId,
      { key: cacheKey, ttl: TTL.EXPLANATION },
    );
  },
};
