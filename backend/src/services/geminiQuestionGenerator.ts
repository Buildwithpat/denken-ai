/**
 * Gemini-Powered Question Generator — Strict Question-Type Edition
 *
 * Generates questions that feel like real competitive-exam questions, not
 * textbook theory. The generation is grounded in three layers:
 *
 *  Layer 1 (Primary)   — Question-bank OCR examples: real phrasing, depth, distractors
 *  Layer 2 (Secondary) — PYQ examples + formula constraints + syllabus alignment
 *  Layer 3 (Tertiary)  — Important-topics intelligence (difficulty calibration)
 *
 * Question-type enforcement:
 *  MCQ      — strictly 4-option single-correct; distractors must be competitive-level
 *  Numerical — strictly calculation-based; memorization must be INSUFFICIENT to answer
 *  Auto-retry if Gemini produces the wrong type (up to 2 retries per batch)
 *
 * Exam personalities (enforced via prompt engineering):
 *  JEE Main:     Formula-application, speed-solving, moderate conceptual MCQ + NAT
 *  JEE Advanced: Multi-concept, calculation-heavy, tricky conceptual, paragraph-based
 *  NEET:         NCERT-oriented, biology-heavy, factual + MCQ-only (no numerical)
 */

import crypto from 'crypto';
import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';
import { env }    from '../config/env';
import { logger } from '../lib/logger';
import { buildGroundingContext, serializeForPrompt } from '../lib/groundingContext';
import { getQuestionBankExamples }                   from '../lib/questionBankGrounding';
import { generateQuestions }  from './questionGenerator';
import type { Question, ResolvedDifficulty } from '../types';

// ── Gemini client (lazy init) ─────────────────────────────────────────────────

let geminiModel: GenerativeModel | null = null;

function getModel(): GenerativeModel | null {
  if (!env.GEMINI_API_KEY) {
    logger.warn('[geminiQGen] GEMINI_API_KEY not set — grounded generation unavailable');
    return null;
  }
  if (!geminiModel) {
    const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    geminiModel = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature:     0.75,
        topP:            0.92,
        maxOutputTokens: 4096,
      },
    });
    logger.info('[geminiQGen] Gemini model initialised (gemini-1.5-flash)');
  }
  return geminiModel;
}

// ── Difficulty distribution ───────────────────────────────────────────────────

interface DifficultySlots {
  easy:   number;
  medium: number;
  hard:   number;
}

function computeDifficultySlots(total: number, exam: string, requested: string): DifficultySlots {
  if (requested !== 'mixed') {
    return {
      easy:   requested === 'easy'   ? total : 0,
      medium: requested === 'medium' ? total : 0,
      hard:   requested === 'hard'   ? total : 0,
    };
  }

  switch (exam) {
    case 'JEE_ADVANCED':
      return {
        easy:   Math.max(1, Math.round(total * 0.10)),
        hard:   Math.max(1, Math.round(total * 0.45)),
        medium: Math.max(0, total - Math.max(1, Math.round(total * 0.10)) - Math.max(1, Math.round(total * 0.45))),
      };
    case 'NEET':
      return {
        easy:   Math.max(1, Math.round(total * 0.40)),
        hard:   Math.max(0, Math.round(total * 0.15)),
        medium: Math.max(0, total - Math.max(1, Math.round(total * 0.40)) - Math.max(0, Math.round(total * 0.15))),
      };
    default: // JEE_MAIN, CBSE
      return {
        easy:   Math.max(1, Math.round(total * 0.30)),
        hard:   Math.max(1, Math.round(total * 0.20)),
        medium: Math.max(0, total - Math.max(1, Math.round(total * 0.30)) - Math.max(1, Math.round(total * 0.20))),
      };
  }
}

// ── Exam-specific personality injections ──────────────────────────────────────

interface ExamPersonality {
  systemRole:       string;
  mcqStyle:         string;
  numericalStyle:   string;
  distractorRule:   string;
  numericalRule:    string;
  prohibitions:     string[];
  mcqExamples:      string[];
  numericalExamples: string[];
}

const EXAM_PERSONALITIES: Record<string, ExamPersonality> = {
  JEE_MAIN: {
    systemRole: 'You are an expert JEE Main question setter with 15+ years of experience. You create questions that test conceptual understanding through formula application and genuine numericals that require calculation.',

    mcqStyle: [
      'Single Correct MCQ with exactly 4 options (A, B, C, D).',
      'Questions must require 2–4 minutes to solve for a well-prepared student.',
      'Use standard JEE Main phrasing: "The value of...", "Find the...", "Which of the following...".',
      'MCQ options must be plausible numbers/statements that arise from common calculation errors or misconceptions.',
      'Difficulty: 30% application (plug-in formula), 50% multi-step problem solving, 20% conceptual insight.',
    ].join(' '),

    numericalStyle: [
      'Numerical Answer Type — the student must calculate and enter a single number.',
      'The question MUST provide specific numerical values (masses, lengths, voltages, concentrations, etc.).',
      'The student MUST apply at least one formula or equation to compute the answer.',
      'Answers should be clean integers or decimals to 2 places (e.g., 3.14, 15, 0.25).',
      'Frame as: "A [object] of [value] [unit] is [scenario]. Find [quantity] (in [unit])." or "The value of [X] is ___."',
      'JEE Main numericals are 5-mark questions requiring direct calculation — never trivia.',
    ].join(' '),

    distractorRule: [
      'MCQ distractors must be: one from correct formula + wrong arithmetic, one from wrong formula applied',
      'correctly, one from a dimensional/sign error, and one that is the actual correct answer.',
      'Rotate the position of the correct answer across questions. All options must look numerically plausible.',
    ].join(' '),

    numericalRule: [
      'MANDATORY for numerical questions:',
      '1. Include specific numerical data in the question (masses, charges, velocities, concentrations, lengths).',
      '2. The answer MUST require formula substitution and arithmetic — not memory retrieval.',
      '3. State the expected unit in the question: "Find the force (in N)", "Calculate the pH", "Find the current (in A)".',
      '4. Answer must be a number: integer or decimal to 2 places.',
      '5. Preferred formats: "A wire of resistance [R]Ω ... find the current", "A block of mass [m] kg ... find work done".',
    ].join(' '),

    prohibitions: [
      'Do NOT ask definition-type questions (e.g., "Which law states...") — these belong in MCQs only.',
      'Do NOT generate numerical questions that can be answered from memory without calculation.',
      'Do NOT ask "How many X does Y have?" — this is a recall question, not a numerical.',
      'Do NOT use open-ended phrasing like "explain" or "describe".',
      'Do NOT ask trivial plug-in-one-formula questions with no conceptual twist in MCQ mode.',
    ],

    mcqExamples: [
      'Two capacitors 3μF and 6μF are connected in series across 12V. The charge on each capacitor is: (A) 24μC (B) 18μC (C) 36μC (D) 12μC',
      'A block slides down a frictionless incline of angle 30°. The acceleration of the block is: (A) 10 m/s² (B) 5 m/s² (C) 5√3 m/s² (D) 2.5 m/s²',
    ],

    numericalExamples: [
      'A wire of resistance 8Ω is connected to a 24V battery. Find the current flowing through the wire (in A). [Answer: 3]',
      'A block of mass 4 kg is placed on a surface with coefficient of kinetic friction μ = 0.25. Find the friction force (in N) if g = 10 m/s². [Answer: 10]',
      'Calculate the pH of 0.001 M HCl solution. [Answer: 3]',
    ],
  },

  JEE_ADVANCED: {
    systemRole: 'You are an elite IIT JEE Advanced question setter (IIT faculty level). You create questions that demand deep multi-concept synthesis, creative problem formulation, and elegant insight. Every question links 2–3 concepts.',

    mcqStyle: [
      'Single Correct MCQ — but options must be subtly distinguished.',
      'Questions must link 2–3 concepts. Use dense, precise technical language.',
      'Every word in the question is deliberate. For MCQ: one option must be subtly correct,',
      'three must be subtly wrong — not obviously eliminable.',
      'Difficulty: 10% moderate, 45% hard, 45% very hard (requires insight + calculation).',
    ].join(' '),

    numericalStyle: [
      'Integer Answer Type — the student calculates and enters a single integer (or decimal).',
      'Questions MUST involve multi-step calculation linking 2 or more physical/chemical principles.',
      'Provide a specific physical/mathematical scenario with numbers. The calculation must be non-trivial.',
      'JEE Advanced numericals test whether the student truly understands the physical model.',
      'Frame as: "In the following setup... find the value of [X]" or "The value of [expression] is ___."',
      'Answers can be multi-digit integers or specific decimals. Calculation must span 4+ steps.',
    ].join(' '),

    distractorRule: [
      'JEE Advanced distractors must catch students who: (A) apply the right principle with wrong boundary condition,',
      '(B) solve a simpler version of the problem, (C) make a sign/direction error in a vector quantity,',
      '(D) correctly get the answer. All distractors must look deeply reasonable to a prepared student.',
    ].join(' '),

    numericalRule: [
      'MANDATORY for numerical questions:',
      '1. The question MUST describe a physical/mathematical scenario with specific numerical parameters.',
      '2. The student must link 2+ concepts (e.g., energy conservation + rotational dynamics, ideal gas + thermodynamics).',
      '3. Include the expected unit or form in the question: "Find the value of [X] in SI units".',
      '4. Answer is an integer or decimal; the path to the answer must span multiple calculation steps.',
      '5. Do NOT set simple "find F = ma" questions — those are JEE Main level.',
    ].join(' '),

    prohibitions: [
      'Do NOT ask anything solvable in under 90 seconds.',
      'Do NOT ask simple single-formula substitution questions.',
      'Do NOT generate numerical questions answerable by memory or direct recall.',
      'Do NOT use vague language — precision is mandatory.',
      'Do NOT create questions solvable by elimination without working.',
    ],

    mcqExamples: [
      'A particle of mass m is attached to a string of length L. Given a velocity v at the lowest point, the tension at angle θ with vertical when the particle just completes the circle is: (A) mg(3cosθ−2) (B) mg(3+2cosθ) (C) m(v²/L + gcosθ) (D) mg(3cosθ+2)',
    ],

    numericalExamples: [
      'A uniform rod of length 2L and mass M is pivoted at one end. It is released from horizontal. Find the angular velocity (in rad/s) when it reaches vertical, given M=3kg, L=1m, g=10m/s². [Answer: ~√15≈3.87, but frame so answer is integer-like]',
      'An ideal gas undergoes isothermal compression from volume V₁=4L to V₂=1L at T=300K. If n=1mol, find the work done by gas (in J, R=8.314). [Answer: -3458]',
    ],
  },

  NEET: {
    systemRole: 'You are an expert NEET question setter with thorough NCERT knowledge. You create MCQ questions that test recall, conceptual understanding, and application as per NCERT Class 11–12. NEET has NO numerical answer type questions.',

    mcqStyle: [
      'Single Correct MCQ only — exactly 4 options (A, B, C, D), exactly 1 correct.',
      'Questions must be answerable from NCERT Class 11–12 text. Do not go beyond NCERT scope.',
      'For Biology: test factual recall, process steps, taxonomic classification, physiological mechanisms.',
      'For Physics/Chemistry: straightforward formula application with standard values.',
      'Phrasing: direct, unambiguous — "Which of the following is correct?", "Identify the...", "The process of...".',
      'Difficulty: 40% direct NCERT recall, 45% NCERT-level application, 15% NCERT-extension inference.',
    ].join(' '),

    numericalStyle: 'NEET does not have numerical answer type questions. Generate MCQ instead.',

    distractorRule: [
      'NEET distractors should: (A) be terms from the same NCERT chapter but used incorrectly,',
      '(B) be common student misconceptions, (C) swap two related concepts, (D) be the correct answer.',
      'All options must seem plausible to an unprepared student.',
    ].join(' '),

    numericalRule: 'NEET has NO numerical answer type questions. All questions must be MCQ.',

    prohibitions: [
      'Do NOT ask questions beyond NCERT Class 11–12 scope.',
      'Do NOT require diagram interpretation.',
      'Do NOT ask "derive" or "prove" questions.',
      'Do NOT create numerical answer type questions — NEET is MCQ-only.',
    ],

    mcqExamples: [
      'Which of the following is the site of ATP synthesis in aerobic respiration? (A) Cytoplasm (B) Matrix of mitochondria (C) Inner mitochondrial membrane (D) Outer mitochondrial membrane',
      'The boiling point of water at high altitudes is lower because: (A) humidity is higher (B) atmospheric pressure is lower (C) temperature is lower (D) air is less dense',
    ],

    numericalExamples: [],
  },
};

function getPersonality(exam: string): ExamPersonality {
  return EXAM_PERSONALITIES[exam] ?? EXAM_PERSONALITIES['JEE_MAIN'];
}

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildGenerationPrompt(
  exam:             string,
  subject:          string,
  topic:            string,
  type:             'mcq' | 'numerical',
  count:            number,
  difficulty:       string,
  groundingText:    string,
  bankExamples:     string,
  difficultySlots:  DifficultySlots,
): string {
  const p = getPersonality(exam);

  const isNumerical = type === 'numerical';

  const typeDesc = isNumerical
    ? 'Numerical Answer Type — CALCULATION REQUIRED (single number answer, NO options)'
    : 'Single Correct MCQ (exactly 4 options A B C D, exactly one correct)';

  const styleGuide = isNumerical ? p.numericalStyle : p.mcqStyle;
  const examples   = isNumerical ? p.numericalExamples : p.mcqExamples;

  const diffSlotDesc = Object.entries(difficultySlots)
    .filter(([, n]) => n > 0)
    .map(([d, n]) => `${n} ${d}`)
    .join(', ');

  const prohibitionsList = p.prohibitions.map(r => `• ${r}`).join('\n');

  const numericalEnforcementBlock = isNumerical ? `
=== CRITICAL: NUMERICAL QUESTION ENFORCEMENT ===
You are generating CALCULATION-BASED numerical questions. Every question MUST satisfy ALL of the following:

✅ REQUIRED:
• The question MUST contain specific numerical values (e.g., mass=5kg, R=3Ω, T=300K, pH=?, distance=2m)
• The student MUST apply a formula/equation to compute the answer — pure recall is FORBIDDEN
• The answer MUST be derived through mathematical steps (substitution, arithmetic, algebra)
• State the target unit explicitly: "Find the force (in N)", "Calculate the current (in A)", "Find the wavelength (in nm)"
• The answer field must contain the correct computed numerical result

❌ FORBIDDEN in numerical mode:
• "How many chromosomes does X have?" → memorization, NOT calculation
• "What is the atomic number of Carbon?" → pure recall
• "In which year was...?" → historical fact
• "How many types of...?" → enumeration
• Any question where a student can answer WITHOUT performing any arithmetic
• Theory questions with a number in the answer that doesn't require calculation

CORRECT numerical format examples:
• "A resistor of 6Ω is connected to a 18V battery in series with a 3Ω resistor. Find the current (in A) flowing through the circuit." [Answer: 2]
• "A body of mass 10 kg moving at 20 m/s collides with a wall and rebounds at 10 m/s. Find the magnitude of impulse (in N·s)." [Answer: 300]
• "Calculate the wavelength (in nm) of light with frequency 5×10¹⁴ Hz. (c = 3×10⁸ m/s)" [Answer: 600]
` : '';

  const outputSchema = isNumerical
    ? `[
  {
    "question": "Complete question text with specific numerical data — precise and unambiguous",
    "type": "numerical",
    "difficulty": "easy|medium|hard",
    "options": null,
    "correctOption": null,
    "answer": <number — the correct computed numerical answer>,
    "diagramDescription": null,
    "topic": "${topic}",
    "subtopic": "specific sub-concept being tested",
    "conceptTags": ["tag1", "tag2"],
    "formulaTags": ["formula name used"]
  }
]`
    : `[
  {
    "question": "Complete question text — precise and unambiguous",
    "type": "mcq",
    "difficulty": "easy|medium|hard",
    "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
    "correctOption": "A"|"B"|"C"|"D",
    "answer": null,
    "diagramDescription": "If the question references a diagram/figure/graph/circuit, describe it here in 1-2 sentences. Otherwise null.",
    "topic": "${topic}",
    "subtopic": "specific sub-concept being tested",
    "conceptTags": ["tag1", "tag2"],
    "formulaTags": ["formula name used, if any"]
  }
]`;

  const examplesBlock = examples.length > 0
    ? `=== STYLE REFERENCE — Questions should feel like these (study the pattern, do NOT copy) ===\n${examples.map(e => `• ${e}`).join('\n')}\n`
    : '';

  return `${p.systemRole}

${bankExamples}

${groundingText}

=== YOUR TASK ===
Generate exactly ${count} original ${typeDesc} question(s) for ${exam}:
  Subject:    ${subject}
  Topic:      ${topic}
  Difficulty: ${difficulty === 'mixed' ? `mixed (${diffSlotDesc})` : difficulty}

=== QUESTION STYLE REQUIREMENTS ===
${styleGuide}

=== DISTRACTOR QUALITY RULE ===
${p.distractorRule}

${numericalEnforcementBlock}
=== NUMERICAL ANSWER RULE ===
${p.numericalRule}

=== STRICT PROHIBITIONS ===
${prohibitionsList}

${examplesBlock}
=== OUTPUT FORMAT ===
Return ONLY a valid JSON array (no markdown fences, no commentary) with this exact schema:
${outputSchema}

CRITICAL:
• Do not output anything outside the JSON array. No introduction, no conclusion.
• For MCQ: options array must have EXACTLY 4 strings. correctOption must be "A", "B", "C", or "D".
• For Numerical: options must be null. correctOption must be null. answer must be a number.
• diagramDescription: only include a 1–2 sentence text description if the question references a circuit, graph, figure, or geometric setup. Use null otherwise.`;
}

// ── Raw response parser ───────────────────────────────────────────────────────

interface GeminiQuestion {
  question:            string;
  type:                'mcq' | 'numerical';
  difficulty:          string;
  options?:            string[] | null;
  correctOption?:      'A' | 'B' | 'C' | 'D' | null;
  answer?:             number | null;
  diagramDescription?: string | null;
  topic:               string;
  subtopic?:           string;
  conceptTags?:        string[];
  formulaTags?:        string[];
}

function parseGeminiResponse(raw: string, expectedType: 'mcq' | 'numerical'): GeminiQuestion[] {
  // Strip markdown code fences
  const cleaned = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();

  const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
  const jsonStr = arrayMatch ? arrayMatch[0] : cleaned;

  try {
    const parsed = JSON.parse(jsonStr);
    if (!Array.isArray(parsed)) {
      logger.warn('[geminiQGen] Response is not a JSON array', { rawLength: raw.length });
      return [];
    }

    const valid = parsed.filter((q: Partial<GeminiQuestion>) => {
      if (!q.question || typeof q.question !== 'string' || q.question.trim().length < 15) return false;

      if (expectedType === 'mcq') {
        // Must have 4 non-empty options and a valid correctOption
        if (!Array.isArray(q.options) || q.options.length !== 4) return false;
        if (!['A', 'B', 'C', 'D'].includes(q.correctOption ?? '')) return false;
        if (q.options.some((o: unknown) => typeof o !== 'string' || !o.trim())) return false;
        // Reject if it looks like a numerical-type question snuck in (has answer set and no proper options)
        if (typeof q.answer === 'number' && !isNaN(q.answer) && !q.correctOption) return false;
      }

      if (expectedType === 'numerical') {
        // Must have a numeric answer
        if (typeof q.answer !== 'number' || isNaN(q.answer)) return false;
        // Reject if Gemini accidentally generated options (wrong type)
        if (Array.isArray(q.options) && q.options.length > 0) {
          logger.warn('[geminiQGen] Numerical question has options — rejecting', { question: q.question?.slice(0, 60) });
          return false;
        }
        // Reject questions that look like pure recall (no digits in question text = likely no real calculation)
        const hasNumericalData = /\d/.test(q.question ?? '');
        if (!hasNumericalData) {
          logger.warn('[geminiQGen] Numerical question has no numbers in text — rejecting', { question: q.question?.slice(0, 80) });
          return false;
        }
      }

      return true;
    });

    logger.debug('[geminiQGen] Parse result', {
      totalParsed: parsed.length,
      validAfterFilter: valid.length,
      expectedType,
    });

    return valid;
  } catch (err) {
    logger.warn('[geminiQGen] JSON parse failed', {
      error:     (err as Error).message,
      rawLength: raw.length,
      snippet:   raw.slice(0, 200),
    });
    return [];
  }
}

// ── Question hydration ────────────────────────────────────────────────────────

function hydrateQuestion(
  raw:          GeminiQuestion,
  subject:      string,
  topicType:    'chapter' | 'unit',
  correctMarks: number,
): Question {
  const difficulty = (['easy', 'medium', 'hard'].includes(raw.difficulty)
    ? raw.difficulty
    : 'medium') as ResolvedDifficulty;

  const base: Question = {
    id:                 crypto.randomUUID(),
    subject,
    topic:              raw.topic,
    topicType,
    difficulty,
    type:               raw.type,
    question:           raw.question,
    marks:              correctMarks,
    conceptTags:        raw.conceptTags ?? [],
    formulaTags:        raw.formulaTags ?? [],
    subtopic:           raw.subtopic,
    diagramDescription: raw.diagramDescription && raw.diagramDescription !== 'null'
      ? raw.diagramDescription
      : undefined,
  };

  if (raw.type === 'mcq' && raw.options && raw.correctOption) {
    base.options       = raw.options as [string, string, string, string];
    base.correctOption = raw.correctOption;
  } else if (raw.type === 'numerical' && raw.answer !== null && raw.answer !== undefined) {
    base.answer = raw.answer;
  }

  return base;
}

// ── Main export ───────────────────────────────────────────────────────────────

export interface GeminiGenParams {
  exam:         string;
  subject:      string;
  topic:        string;
  topicType:    'chapter' | 'unit';
  difficulty:   string;
  type:         'mcq' | 'numerical';
  count:        number;
  correctMarks: number;
}

export interface GeminiGenResult {
  questions: Question[];
  source:    'gemini-grounded' | 'template-fallback';
  debugLog: {
    exam:                string;
    subject:             string;
    topic:               string;
    requestedType:       string;
    requestedCount:      number;
    generatedCount:      number;
    mcqCount:            number;
    numericalCount:      number;
    source:              string;
    groundingDebug:      object;
    bankGroundingDebug:  object;
    promptTokensEst:     number;
    latencyMs:           number;
    examPersonality:     string;
    retryCount:          number;
    rejectedCount:       number;
    error?:              string;
  };
}

/**
 * Generate questions using Gemini grounded in question-bank examples,
 * PYQ patterns, formula datasets, and important-topics intelligence.
 *
 * Falls back to template generation if:
 *  - GEMINI_API_KEY is not set
 *  - Gemini call fails / times out (30s)
 *  - Parsed output has fewer than 1 valid question after 2 retries
 */
export async function generateGroundedQuestions(params: GeminiGenParams): Promise<GeminiGenResult> {
  const t0 = Date.now();
  const { exam, subject, topic, topicType, difficulty, type, count, correctMarks } = params;

  const model = getModel();

  const templateFallback = (reason: string, err?: string, retryCount = 0, rejectedCount = 0): GeminiGenResult => {
    logger.info('[geminiQGen] Using template fallback', { reason, exam, subject, topic, count, type });
    const questions = generateQuestions(
      subject, topic, topicType,
      difficulty as 'easy' | 'medium' | 'hard' | 'mixed',
      type, count, correctMarks,
    );
    return {
      questions,
      source: 'template-fallback',
      debugLog: {
        exam, subject, topic,
        requestedType:      type,
        requestedCount:     count,
        generatedCount:     questions.length,
        mcqCount:           questions.filter(q => q.type === 'mcq').length,
        numericalCount:     questions.filter(q => q.type === 'numerical').length,
        source:             'template-fallback',
        groundingDebug:     {},
        bankGroundingDebug: {},
        promptTokensEst:    0,
        latencyMs:          Date.now() - t0,
        examPersonality:    exam,
        retryCount,
        rejectedCount,
        error:              err ?? reason,
      },
    };
  };

  if (!model) return templateFallback('no-api-key');

  try {
    // ── Layer 1: Question-bank grounding (primary realism layer) ──────────────
    const bankResult = getQuestionBankExamples(exam, subject, topic, Math.min(4, count + 1));

    logger.debug('[geminiQGen] Bank grounding loaded', {
      exam, subject, topic,
      filesLoaded:    bankResult.debugLog.filesLoaded,
      totalAvailable: bankResult.debugLog.totalAvailable,
      selected:       bankResult.debugLog.selected,
    });

    // ── Layer 2: PYQ + formula + syllabus + intelligence grounding ────────────
    const groundingCtx = await buildGroundingContext({
      exam, subject, chapter: topic, topic,
      pyqLimit:     Math.min(3, count),
      formulaLimit: 6,
    });
    const groundingText = serializeForPrompt(groundingCtx);

    const difficultySlots = computeDifficultySlots(count, exam, difficulty);

    const prompt = buildGenerationPrompt(
      exam, subject, topic, type, count, difficulty,
      groundingText,
      bankResult.formatted,
      difficultySlots,
    );

    const promptTokensEst = Math.round(prompt.length / 4);

    logger.info('[geminiQGen] Calling Gemini', {
      exam, subject, topic, type, count, difficulty,
      bankExamplesInjected: bankResult.debugLog.selected,
      pyqsInjected:         groundingCtx.debugLog.pyqsSelected,
      formulasInjected:     groundingCtx.debugLog.formulasUsed,
      importantTopicFound:  groundingCtx.debugLog.importantTopicFound,
      examPersonality:      exam,
      promptTokensEst,
    });

    // ── Call Gemini with retry logic ─────────────────────────────────────────
    let allValidQuestions: GeminiQuestion[] = [];
    let retryCount = 0;
    let totalRejected = 0;
    const MAX_RETRIES = 2;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      if (allValidQuestions.length >= count) break;

      if (attempt > 0) {
        retryCount++;
        const remaining = count - allValidQuestions.length;
        logger.info('[geminiQGen] Retry attempt', { attempt, remaining, type, exam, subject, topic });
      }

      const callPromise   = model.generateContent(prompt);
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Gemini timeout (30s)')), 30_000),
      );

      const result  = await Promise.race([callPromise, timeoutPromise]);
      const rawText = result.response.text();

      const parsed = parseGeminiResponse(rawText, type);
      const previousCount = allValidQuestions.length;

      // Merge new valid questions (avoid duplicates by question text similarity)
      for (const q of parsed) {
        const isDuplicate = allValidQuestions.some(
          existing => existing.question.slice(0, 40) === q.question.slice(0, 40),
        );
        if (!isDuplicate) allValidQuestions.push(q);
      }

      const newlyAdded = allValidQuestions.length - previousCount;
      totalRejected += parsed.length - newlyAdded;

      logger.info('[geminiQGen] Gemini response', {
        attempt, exam, subject, topic, type,
        requested: count, parsedValid: parsed.length,
        newlyAdded, totalValid: allValidQuestions.length,
        latencyMs: Date.now() - t0,
      });

      if (allValidQuestions.length === 0 && attempt === MAX_RETRIES) {
        return templateFallback('gemini-returned-0-valid-questions-after-retries', undefined, retryCount, totalRejected);
      }
    }

    // ── Hydrate ───────────────────────────────────────────────────────────────
    const questions: Question[] = allValidQuestions
      .slice(0, count)
      .map(q => hydrateQuestion(q, subject, topicType, correctMarks));

    // Pad with templates if Gemini returned fewer than requested
    if (questions.length < count) {
      const remaining = count - questions.length;
      logger.info('[geminiQGen] Padding with templates', { remaining, type });
      const templates = generateQuestions(
        subject, topic, topicType,
        difficulty as 'easy' | 'medium' | 'hard' | 'mixed',
        type, remaining, correctMarks,
      );
      questions.push(...templates);
    }

    const mcqCount       = questions.filter(q => q.type === 'mcq').length;
    const numericalCount = questions.filter(q => q.type === 'numerical').length;

    logger.info('[geminiQGen] Generation complete', {
      exam, subject, topic, requestedType: type,
      totalGenerated: questions.length, mcqCount, numericalCount,
      retryCount, rejectedCount: totalRejected,
      source: 'gemini-grounded',
    });

    return {
      questions,
      source: 'gemini-grounded',
      debugLog: {
        exam, subject, topic,
        requestedType:      type,
        requestedCount:     count,
        generatedCount:     questions.length,
        mcqCount,
        numericalCount,
        source:             'gemini-grounded',
        groundingDebug:     groundingCtx.debugLog,
        bankGroundingDebug: bankResult.debugLog,
        promptTokensEst,
        latencyMs:          Date.now() - t0,
        examPersonality:    exam,
        retryCount,
        rejectedCount:      totalRejected,
      },
    };
  } catch (err) {
    const message = (err as Error).message;
    logger.error('[geminiQGen] Generation failed', { error: message, exam, subject, topic, type });
    return templateFallback(`gemini-error: ${message}`, message);
  }
}
