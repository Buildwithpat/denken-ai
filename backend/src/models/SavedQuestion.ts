import mongoose, { Schema, Document, Types } from 'mongoose';
import { ExamKey, Question } from '../types';

export interface ISavedQuestion {
  userId: Types.ObjectId;
  exam: ExamKey;
  question: Question;
  note?: string;
}

export interface ISavedQuestionDocument extends ISavedQuestion, Document {
  _id: Types.ObjectId;
}

const savedQuestionSchema = new Schema<ISavedQuestionDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    exam:   { type: String, enum: ['CBSE', 'JEE_MAIN', 'JEE_ADVANCED', 'NEET'], required: true },
    question: {
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
    },
    note: { type: String, trim: true },
  },
  { timestamps: true },
);

savedQuestionSchema.index({ userId: 1, createdAt: -1 });
// Prevent duplicates: one user can't save the same question twice
savedQuestionSchema.index({ userId: 1, 'question.id': 1 }, { unique: true });

const SavedQuestion = mongoose.model<ISavedQuestionDocument>('SavedQuestion', savedQuestionSchema);
export default SavedQuestion;
