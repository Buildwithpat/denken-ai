import mongoose, { Schema, Document, Types } from 'mongoose';

// ── AI-generated explanation styles ───────────────────────────────────────────

export type ExplanationStyle =
  | 'step-by-step'
  | 'beginner'
  | 'intermediate'
  | 'advanced'
  | 'mistake-aware'
  | 'alternative';

// ── One cached explanation per (stableId + style) ────────────────────────────
// TTL: 7 days. Regenerated if expired or if question version changes.

export interface IQuestionExplanation {
  stableId:       string;      // FK → QuestionBank.stableId
  style:          ExplanationStyle;
  questionVersion: number;     // invalidate if question.version changes

  // ── Content ──────────────────────────────────────────────────────────────────
  explanation:      string;    // Main explanation text (markdown)
  stepByStep:       string[];  // Ordered solution steps
  keyInsight:       string;    // The one critical concept this tests
  commonMistakes:   string[];  // What students typically get wrong here
  hintsProgressive: string[];  // 3 graduated hints (H1 least → H3 most revealing)
  alternativeMethod?: string;  // Alternative solving approach
  formulasUsed:     string[];  // "name: equation" strings

  generatedBy: string;         // 'gemini' | 'mock'
  expiresAt:   Date;           // TTL for cache invalidation

  createdAt?: Date;
}

export interface IQuestionExplanationDocument extends IQuestionExplanation, Document {
  _id: Types.ObjectId;
}

// ── Schema ────────────────────────────────────────────────────────────────────

const questionExplanationSchema = new Schema<IQuestionExplanationDocument>(
  {
    stableId:        { type: String, required: true },
    style:           { type: String, enum: ['step-by-step','beginner','intermediate','advanced','mistake-aware','alternative'], required: true },
    questionVersion: { type: Number, required: true },

    explanation:       { type: String, required: true },
    stepByStep:        { type: [String], default: [] },
    keyInsight:        { type: String, default: '' },
    commonMistakes:    { type: [String], default: [] },
    hintsProgressive:  { type: [String], default: [] },
    alternativeMethod: { type: String },
    formulasUsed:      { type: [String], default: [] },

    generatedBy: { type: String, default: 'mock' },
    expiresAt:   { type: Date, required: true },
  },
  { timestamps: true },
);

questionExplanationSchema.index({ stableId: 1, style: 1 }, { unique: true });
questionExplanationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // MongoDB TTL

const QuestionExplanation = mongoose.model<IQuestionExplanationDocument>(
  'QuestionExplanation',
  questionExplanationSchema,
);
export default QuestionExplanation;
