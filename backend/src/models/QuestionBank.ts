import mongoose, { Schema, Document, Types } from 'mongoose';
import type { ExamKey, ResolvedDifficulty } from '../types';

// ── Taxonomy types ────────────────────────────────────────────────────────────

export type BloomLevel    = 'remember' | 'understand' | 'apply' | 'analyze' | 'evaluate' | 'create';
export type SkillCategory = 'recall' | 'understanding' | 'application' | 'analysis' | 'synthesis' | 'evaluation';
export type QuestionSource = 'curated' | 'generated' | 'imported' | 'pyq';

// ── Sub-document interfaces ───────────────────────────────────────────────────

export interface IFormulaLink {
  formulaSlug:    string;
  subjectSlug:    string;
  formulaName:    string;
}

export interface IConceptLink {
  conceptId:    string;
  conceptName:  string;
  relationship: 'tests' | 'requires' | 'introduces';
}

// ── Main interface ────────────────────────────────────────────────────────────

export interface IQuestionBank {
  // ── Identity ────────────────────────────────────────────────────────────────
  stableId:    string;        // deterministic UUID — survives re-generation
  source:      QuestionSource;
  version:     number;
  isActive:    boolean;
  qualityScore: number;       // 0–100; admin-rated or computed

  // ── Content ─────────────────────────────────────────────────────────────────
  questionText:  string;
  options?:      [string, string, string, string];
  correctOption?: 'A' | 'B' | 'C' | 'D';
  answer?:       number;                 // numerical answer
  type:          'mcq' | 'numerical';
  marks:         number;

  // ── Classification ──────────────────────────────────────────────────────────
  exams:      ExamKey[];
  subject:    string;
  chapter:    string;
  topic:      string;
  subtopic?:  string;
  topicType:  'chapter' | 'unit';

  // ── Tags & links ────────────────────────────────────────────────────────────
  conceptTags:    string[];            // free-form concept labels
  formulaTags:    string[];            // formula slugs from formulaLoader
  formulaLinks:   IFormulaLink[];      // structured formula references
  conceptLinks:   IConceptLink[];      // structured concept-graph references
  prerequisiteTopics: string[];        // topic names that must be understood first

  // ── Difficulty ──────────────────────────────────────────────────────────────
  difficulty:               ResolvedDifficulty;
  difficultyScore:          number;    // 0–100 static calibration
  adaptiveDifficultyScore:  number;    // 0–100 dynamically updated from performance

  // ── Learning taxonomy ────────────────────────────────────────────────────────
  bloomLevel:              BloomLevel;
  skillCategory:           SkillCategory;
  learningObjective:       string;
  expectedSolvingTimeSec:  number;     // design-time estimate in seconds

  // ── Exam targeting ──────────────────────────────────────────────────────────
  examRelevance:            Record<string, number>; // ExamKey → 0–1
  chapterWeightageScore:    number;                 // 0–1 from roadmap weightage
  isPYQ:                    boolean;
  pyqYear?:                 number;
  pyqExam?:                 string;

  // ── Denormalised performance (updated by QuestionPerformanceService) ─────────
  totalAttempts:       number;
  correctAttempts:     number;
  avgSolvingTimeSec:   number;
  dominantMistakeType?: string;

  // ── Embeddings tracking ──────────────────────────────────────────────────────
  isEmbedded:       boolean;   // whether question has been indexed in ChromaDB
  embeddedAt?:      Date;

  createdAt?: Date;
  updatedAt?: Date;
}

export interface IQuestionBankDocument extends IQuestionBank, Document {
  _id: Types.ObjectId;
}

// ── Sub-schemas ───────────────────────────────────────────────────────────────

const formulaLinkSchema = new Schema<IFormulaLink>(
  {
    formulaSlug:  { type: String, required: true },
    subjectSlug:  { type: String, required: true },
    formulaName:  { type: String, required: true },
  },
  { _id: false },
);

const conceptLinkSchema = new Schema<IConceptLink>(
  {
    conceptId:    { type: String, required: true },
    conceptName:  { type: String, required: true },
    relationship: { type: String, enum: ['tests', 'requires', 'introduces'], default: 'tests' },
  },
  { _id: false },
);

// ── Main schema ───────────────────────────────────────────────────────────────

const questionBankSchema = new Schema<IQuestionBankDocument>(
  {
    stableId:     { type: String, required: true, unique: true },
    source:       { type: String, enum: ['curated', 'generated', 'imported', 'pyq'], default: 'curated' },
    version:      { type: Number, default: 1 },
    isActive:     { type: Boolean, default: true },
    qualityScore: { type: Number, default: 80, min: 0, max: 100 },

    questionText:  { type: String, required: true },
    options:       { type: [String] },
    correctOption: { type: String, enum: ['A', 'B', 'C', 'D'] },
    answer:        { type: Number },
    type:          { type: String, enum: ['mcq', 'numerical'], required: true },
    marks:         { type: Number, required: true },

    exams:      { type: [String], default: [] },
    subject:    { type: String, required: true },
    chapter:    { type: String, required: true },
    topic:      { type: String, required: true },
    subtopic:   { type: String },
    topicType:  { type: String, enum: ['chapter', 'unit'], default: 'chapter' },

    conceptTags:        { type: [String], default: [] },
    formulaTags:        { type: [String], default: [] },
    formulaLinks:       { type: [formulaLinkSchema], default: [] },
    conceptLinks:       { type: [conceptLinkSchema], default: [] },
    prerequisiteTopics: { type: [String], default: [] },

    difficulty:              { type: String, enum: ['easy', 'medium', 'hard'], required: true },
    difficultyScore:         { type: Number, default: 50, min: 0, max: 100 },
    adaptiveDifficultyScore: { type: Number, default: 50, min: 0, max: 100 },

    bloomLevel:             { type: String, enum: ['remember','understand','apply','analyze','evaluate','create'], default: 'understand' },
    skillCategory:          { type: String, enum: ['recall','understanding','application','analysis','synthesis','evaluation'], default: 'understanding' },
    learningObjective:      { type: String, default: '' },
    expectedSolvingTimeSec: { type: Number, default: 90 },

    examRelevance:         { type: Map, of: Number, default: {} },
    chapterWeightageScore: { type: Number, default: 0.5, min: 0, max: 1 },
    isPYQ:                 { type: Boolean, default: false },
    pyqYear:               { type: Number },
    pyqExam:               { type: String },

    totalAttempts:      { type: Number, default: 0 },
    correctAttempts:    { type: Number, default: 0 },
    avgSolvingTimeSec:  { type: Number, default: 0 },
    dominantMistakeType: { type: String },

    isEmbedded: { type: Boolean, default: false },
    embeddedAt: { type: Date },
  },
  { timestamps: true },
);

// ── Indexes ───────────────────────────────────────────────────────────────────

// Core navigation
questionBankSchema.index({ subject: 1, chapter: 1, topic: 1 });
questionBankSchema.index({ subject: 1, difficulty: 1, type: 1 });
questionBankSchema.index({ exams: 1, subject: 1 });
questionBankSchema.index({ bloomLevel: 1 });
questionBankSchema.index({ isPYQ: 1, pyqYear: -1 });
questionBankSchema.index({ isActive: 1, qualityScore: -1 });
questionBankSchema.index({ conceptTags: 1 });
questionBankSchema.index({ formulaTags: 1 });

// Compound index covering the adaptive question-selection hot path:
// selectFromBank filters: isActive + exams + subject + chapter/topic + difficulty
questionBankSchema.index({ isActive: 1, exams: 1, subject: 1, chapter: 1, difficulty: 1, qualityScore: -1 });

// Embedding lifecycle: find un-embedded or stale questions
questionBankSchema.index({ isEmbedded: 1, updatedAt: -1 });

const QuestionBank = mongoose.model<IQuestionBankDocument>('QuestionBank', questionBankSchema);
export default QuestionBank;
