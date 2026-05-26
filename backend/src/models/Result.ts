import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IAnswer {
  questionId: string;
  selectedOption?: 'A' | 'B' | 'C' | 'D';
  numericalValue?: number;
  isMarked: boolean;
  isCorrect: boolean;
  marksAwarded: number;
}

export interface ISubjectSummary {
  subject: string;
  correct: number;
  wrong: number;
  unattempted: number;
  score: number;
}

export interface IResult {
  userId: Types.ObjectId;
  testId: Types.ObjectId;
  answers: IAnswer[];
  totalScore: number;
  correctCount: number;
  wrongCount: number;
  unattemptedCount: number;
  timeTaken: number;
  subjectWise: ISubjectSummary[];
}

export interface IResultDocument extends IResult, Document {
  _id: Types.ObjectId;
}

const answerSchema = new Schema<IAnswer>(
  {
    questionId:     { type: String, required: true },
    selectedOption: { type: String, enum: ['A', 'B', 'C', 'D'] },
    numericalValue: { type: Number },
    isMarked:       { type: Boolean, default: false },
    isCorrect:      { type: Boolean, required: true },
    marksAwarded:   { type: Number, required: true },
  },
  { _id: false },
);

const subjectSummarySchema = new Schema<ISubjectSummary>(
  {
    subject:     { type: String, required: true },
    correct:     { type: Number, required: true },
    wrong:       { type: Number, required: true },
    unattempted: { type: Number, required: true },
    score:       { type: Number, required: true },
  },
  { _id: false },
);

const resultSchema = new Schema<IResultDocument>(
  {
    userId:           { type: Schema.Types.ObjectId, ref: 'User', required: true },
    testId:           { type: Schema.Types.ObjectId, ref: 'Test', required: true },
    answers:          { type: [answerSchema], required: true },
    totalScore:       { type: Number, required: true },
    correctCount:     { type: Number, required: true },
    wrongCount:       { type: Number, required: true },
    unattemptedCount: { type: Number, required: true },
    timeTaken:        { type: Number, required: true },
    subjectWise:      { type: [subjectSummarySchema], required: true },
  },
  { timestamps: true },
);

resultSchema.index({ userId: 1, createdAt: -1 });
resultSchema.index({ testId: 1 });

const Result = mongoose.model<IResultDocument>('Result', resultSchema);
export default Result;
