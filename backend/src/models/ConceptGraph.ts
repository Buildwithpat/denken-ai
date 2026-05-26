import mongoose, { Schema, Document, Types } from 'mongoose';

// ── Concept node in the prerequisite graph ─────────────────────────────────
// Each node represents one learnable concept.
// Edges are stored as prerequisite lists (directed: A requires B means B → A).

export type ConceptDifficulty = 'foundational' | 'intermediate' | 'advanced';

export interface IConceptNode {
  conceptId:   string;   // stable slug e.g. "kinematics-equations-of-motion"
  name:        string;   // display name e.g. "Equations of Motion"
  subject:     string;
  chapter:     string;
  topic:       string;
  subtopic?:   string;
  description: string;

  // ── Graph edges ───────────────────────────────────────────────────────────────
  prerequisites: string[];   // conceptId[] — must master these before this
  enables:       string[];   // conceptId[] — mastering this unlocks these

  // ── Metadata ──────────────────────────────────────────────────────────────────
  bloomLevel:   string;
  difficulty:   ConceptDifficulty;
  difficultyScore: number;   // 0–100

  // ── Formula and question links ────────────────────────────────────────────────
  formulaLinks:    string[];  // formula slugs
  questionTags:    string[];  // conceptTags that question bank questions use
  examTargets:     string[];  // ExamKey[]

  // ── Learning time estimate ────────────────────────────────────────────────────
  estimatedStudyMinutes: number;

  isActive: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export interface IConceptNodeDocument extends IConceptNode, Document {
  _id: Types.ObjectId;
}

// ── Schema ────────────────────────────────────────────────────────────────────

const conceptNodeSchema = new Schema<IConceptNodeDocument>(
  {
    conceptId:    { type: String, required: true, unique: true },
    name:         { type: String, required: true },
    subject:      { type: String, required: true },
    chapter:      { type: String, required: true },
    topic:        { type: String, required: true },
    subtopic:     { type: String },
    description:  { type: String, default: '' },

    prerequisites: { type: [String], default: [] },
    enables:       { type: [String], default: [] },

    bloomLevel:      { type: String, default: 'understand' },
    difficulty:      { type: String, enum: ['foundational', 'intermediate', 'advanced'], default: 'intermediate' },
    difficultyScore: { type: Number, default: 50, min: 0, max: 100 },

    formulaLinks:    { type: [String], default: [] },
    questionTags:    { type: [String], default: [] },
    examTargets:     { type: [String], default: [] },

    estimatedStudyMinutes: { type: Number, default: 30 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

conceptNodeSchema.index({ subject: 1, chapter: 1 });
conceptNodeSchema.index({ topic: 1 });
conceptNodeSchema.index({ examTargets: 1 });
conceptNodeSchema.index({ prerequisites: 1 });

const ConceptGraph = mongoose.model<IConceptNodeDocument>('ConceptGraph', conceptNodeSchema);
export default ConceptGraph;
