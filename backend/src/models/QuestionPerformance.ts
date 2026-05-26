import mongoose, { Schema, Document, Types } from 'mongoose';

// ── Per-question aggregate analytics ─────────────────────────────────────────
// One document per (stableId) — updated after every Result is graded.

export interface IMistakeCounts {
  conceptual:    number;
  careless:      number;
  formula:       number;
  timePressure:  number;
  weakRetention: number;
  guessing:      number;
  repeated:      number;
}

export interface IQuestionPerformance {
  stableId:  string;   // FK → QuestionBank.stableId
  subject:   string;
  chapter:   string;
  topic:     string;

  // ── Aggregate stats ──────────────────────────────────────────────────────────
  totalAttempts:       number;
  correctAttempts:     number;
  totalSolvingTimeSec: number;   // running sum; avg = total / attempts
  sumSolvingTimeSq:    number;   // for stddev computation

  // ── Mistake breakdown ────────────────────────────────────────────────────────
  mistakeCounts:       IMistakeCounts;
  dominantMistakeType: string | null;

  // ── Derived scores (recomputed on each update) ────────────────────────────────
  accuracy:              number;   // 0–100
  avgSolvingTimeSec:     number;
  stdDevSolvingTimeSec:  number;
  // Item discrimination: P(correct | high mastery) − P(correct | low mastery)
  discriminationIndex:   number;   // -1 → 1; higher = better discriminator

  // ── Adaptive scoring (updated periodically) ──────────────────────────────────
  adaptiveUsefulnessScore:  number;  // 0–100: how much this Q separates mastery levels
  retentionImpactScore:     number;  // 0–100: high = wrong answers here hurt retention a lot
  confidenceImpactScore:    number;  // 0–100: high = getting this wrong hurts student confidence

  // ── Dynamic difficulty calibration ───────────────────────────────────────────
  // Moving average of observed difficulty (wrong/attempted) over last 50 attempts
  observedDifficultyScore: number;   // 0–100

  // ── Cohort tracking (for discrimination) ─────────────────────────────────────
  highMasteryAttempts:  number;   // attempts by users with masteryScore > 70
  highMasteryCorrect:   number;
  lowMasteryAttempts:   number;   // attempts by users with masteryScore < 40
  lowMasteryCorrect:    number;

  lastAttemptAt: Date;
  updatedAt?:    Date;
}

export interface IQuestionPerformanceDocument extends IQuestionPerformance, Document {
  _id: Types.ObjectId;
}

// ── Schema ────────────────────────────────────────────────────────────────────

const mistakeCountsSchema = new Schema<IMistakeCounts>(
  {
    conceptual:    { type: Number, default: 0 },
    careless:      { type: Number, default: 0 },
    formula:       { type: Number, default: 0 },
    timePressure:  { type: Number, default: 0 },
    weakRetention: { type: Number, default: 0 },
    guessing:      { type: Number, default: 0 },
    repeated:      { type: Number, default: 0 },
  },
  { _id: false },
);

const questionPerformanceSchema = new Schema<IQuestionPerformanceDocument>(
  {
    stableId: { type: String, required: true, unique: true },
    subject:  { type: String, required: true },
    chapter:  { type: String, required: true },
    topic:    { type: String, required: true },

    totalAttempts:       { type: Number, default: 0 },
    correctAttempts:     { type: Number, default: 0 },
    totalSolvingTimeSec: { type: Number, default: 0 },
    sumSolvingTimeSq:    { type: Number, default: 0 },

    mistakeCounts:       { type: mistakeCountsSchema, default: () => ({}) },
    dominantMistakeType: { type: String, default: null },

    accuracy:             { type: Number, default: 0 },
    avgSolvingTimeSec:    { type: Number, default: 0 },
    stdDevSolvingTimeSec: { type: Number, default: 0 },
    discriminationIndex:  { type: Number, default: 0 },

    adaptiveUsefulnessScore:  { type: Number, default: 50 },
    retentionImpactScore:     { type: Number, default: 50 },
    confidenceImpactScore:    { type: Number, default: 50 },
    observedDifficultyScore:  { type: Number, default: 50 },

    highMasteryAttempts: { type: Number, default: 0 },
    highMasteryCorrect:  { type: Number, default: 0 },
    lowMasteryAttempts:  { type: Number, default: 0 },
    lowMasteryCorrect:   { type: Number, default: 0 },

    lastAttemptAt: { type: Date, required: true },
  },
  { timestamps: true },
);

questionPerformanceSchema.index({ subject: 1, chapter: 1 });
questionPerformanceSchema.index({ accuracy: 1 });
questionPerformanceSchema.index({ adaptiveUsefulnessScore: -1 });

const QuestionPerformance = mongoose.model<IQuestionPerformanceDocument>(
  'QuestionPerformance',
  questionPerformanceSchema,
);
export default QuestionPerformance;
