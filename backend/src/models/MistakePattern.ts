import mongoose, { Schema, Document, Types } from 'mongoose';

export type MistakeType =
  | 'conceptual'
  | 'careless'
  | 'formula'
  | 'time-pressure'
  | 'weak-retention'
  | 'guessing'
  | 'repeated';

export interface IMistakeCounts {
  conceptual:    number;
  careless:      number;
  formula:       number;
  timePressure:  number;
  weakRetention: number;
  guessing:      number;
  repeated:      number;
}

export interface IMistakePattern {
  userId:                  Types.ObjectId;
  topic:                   string;
  subject:                 string;
  totalMistakes:           number;
  recentMistakes:          number;   // wrong answers in last 30 days
  consecutiveWrong:        number;   // unbroken wrong streak across tests
  mistakeCounts:           IMistakeCounts;
  dominantType:            MistakeType;
  linkedFormulaChapterSlug: string | null;
  linkedSubjectSlug:        string | null;
  lastMistakeAt:           Date;
  insight:                 string;
}

export interface IMistakePatternDocument extends IMistakePattern, Document {
  _id: Types.ObjectId;
  updatedAt: Date;
}

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

const mistakePatternSchema = new Schema<IMistakePatternDocument>(
  {
    userId:                   { type: Schema.Types.ObjectId, ref: 'User', required: true },
    topic:                    { type: String, required: true },
    subject:                  { type: String, required: true },
    totalMistakes:            { type: Number, default: 0 },
    recentMistakes:           { type: Number, default: 0 },
    consecutiveWrong:         { type: Number, default: 0 },
    mistakeCounts:            { type: mistakeCountsSchema, default: () => ({}) },
    dominantType:             { type: String, default: 'conceptual' },
    linkedFormulaChapterSlug: { type: String, default: null },
    linkedSubjectSlug:        { type: String, default: null },
    lastMistakeAt:            { type: Date, required: true },
    insight:                  { type: String, default: '' },
  },
  { timestamps: true },
);

mistakePatternSchema.index({ userId: 1, topic: 1 }, { unique: true });
mistakePatternSchema.index({ userId: 1, lastMistakeAt: -1 });
mistakePatternSchema.index({ userId: 1, totalMistakes: -1 });
// Adaptive practice recommendations: sort by consecutiveWrong + totalMistakes
mistakePatternSchema.index({ userId: 1, consecutiveWrong: -1, totalMistakes: -1 });

const MistakePattern = mongoose.model<IMistakePatternDocument>('MistakePattern', mistakePatternSchema);
export default MistakePattern;
