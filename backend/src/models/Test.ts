import mongoose, { Schema, Document, Types } from 'mongoose';
import { ExamKey, Difficulty, CbseClassFilter, Question } from '../types';

export type TestMode = 'normal' | 'rapid' | 'pyq' | 'mistake' | 'smart';

export interface ITest {
  userId: Types.ObjectId;
  exam: ExamKey;
  subjects: string[];
  chapters?: string[];
  difficulty: Difficulty;
  mode: TestMode;
  questionCount: number;
  duration: number;
  marking: { correct: number; wrong: number };
  cbseClass?: CbseClassFilter;
  questions: Question[];
}

export interface ITestDocument extends ITest, Document {
  _id: Types.ObjectId;
}

const questionSchema = new Schema<Question>(
  {
    id:            { type: String, required: true },
    subject:       { type: String, required: true },
    topic:         { type: String, required: true },
    topicType:     { type: String, enum: ['chapter', 'unit'], required: true },
    difficulty:    { type: String, enum: ['easy', 'medium', 'hard'], required: true },
    type:          { type: String, enum: ['mcq', 'numerical'], required: true },
    question:      { type: String, required: true },
    options:       { type: [String] },
    correctOption: { type: String, enum: ['A', 'B', 'C', 'D'] },
    answer:        { type: Number },
    marks:         { type: Number, required: true },
    // Question Intelligence fields (optional — present only for bank-sourced questions)
    bankQuestionId:         { type: String },
    chapter:                { type: String },
    subtopic:               { type: String },
    conceptTags:            { type: [String] },
    formulaTags:            { type: [String] },
    bloomLevel:             { type: String },
    skillCategory:          { type: String },
    learningObjective:      { type: String },
    expectedSolvingTimeSec: { type: Number },
    prerequisiteTopics:     { type: [String] },
  },
  { _id: false },
);

const testSchema = new Schema<ITestDocument>(
  {
    userId:        { type: Schema.Types.ObjectId, ref: 'User', required: true },
    exam:          { type: String, enum: ['CBSE', 'JEE_MAIN', 'JEE_ADVANCED', 'NEET'], required: true },
    subjects:      { type: [String], required: true },
    chapters:      { type: [String] },
    difficulty:    { type: String, enum: ['easy', 'medium', 'hard', 'mixed'], required: true },
    mode:          { type: String, enum: ['normal', 'rapid', 'pyq', 'mistake', 'smart'], default: 'normal' },
    questionCount: { type: Number, required: true },
    duration:      { type: Number, required: true },
    marking:       {
      correct: { type: Number, required: true },
      wrong:   { type: Number, required: true },
    },
    cbseClass:     { type: String, enum: ['11', '12', 'both'] },
    questions:     { type: [questionSchema], required: true },
  },
  { timestamps: true },
);

testSchema.index({ userId: 1, createdAt: -1 });

const Test = mongoose.model<ITestDocument>('Test', testSchema);
export default Test;
