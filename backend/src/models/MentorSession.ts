/**
 * MentorSession — long-term AI memory for each student.
 *
 * Stores:
 *  - Recent conversation history (last 20 messages, rolling window)
 *  - Identified recurring weaknesses across sessions
 *  - Session metadata for continuity
 *
 * This is the persistence layer for the AI mentor's long-term memory.
 * The session is updated after each mentor interaction.
 */
import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IMessage {
  role:      'user' | 'assistant';
  content:   string;
  intent:    string;
  chapter:   string | null;
  subject:   string | null;
  createdAt: Date;
}

export interface IWeakness {
  topic:        string;
  subject:      string;
  mistakeType:  string;
  firstSeenAt:  Date;
  lastSeenAt:   Date;
  occurrences:  number;
  aiInsight:    string;
}

export interface IMentorSession {
  userId:               Types.ObjectId;
  messages:             IMessage[];
  identifiedWeaknesses: IWeakness[];
  totalInteractions:    number;
  lastActiveAt:         Date;
  preferredDepth:       'beginner' | 'medium' | 'advanced' | 'adaptive';
}

export interface IMentorSessionDocument extends IMentorSession, Document {
  _id: Types.ObjectId;
}

const messageSchema = new Schema<IMessage>(
  {
    role:      { type: String, enum: ['user', 'assistant'], required: true },
    content:   { type: String, required: true },
    intent:    { type: String, default: 'explain' },
    chapter:   { type: String, default: null },
    subject:   { type: String, default: null },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const weaknessSchema = new Schema<IWeakness>(
  {
    topic:       { type: String, required: true },
    subject:     { type: String, required: true },
    mistakeType: { type: String, default: 'conceptual' },
    firstSeenAt: { type: Date, default: Date.now },
    lastSeenAt:  { type: Date, default: Date.now },
    occurrences: { type: Number, default: 1 },
    aiInsight:   { type: String, default: '' },
  },
  { _id: false },
);

const mentorSessionSchema = new Schema<IMentorSessionDocument>(
  {
    userId:               { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    messages:             { type: [messageSchema], default: [] },
    identifiedWeaknesses: { type: [weaknessSchema], default: [] },
    totalInteractions:    { type: Number, default: 0 },
    lastActiveAt:         { type: Date, default: Date.now },
    preferredDepth:       { type: String, enum: ['beginner', 'medium', 'advanced', 'adaptive'], default: 'adaptive' },
  },
  { timestamps: true },
);

mentorSessionSchema.index({ userId: 1 });
mentorSessionSchema.index({ userId: 1, lastActiveAt: -1 });

const MentorSession = mongoose.model<IMentorSessionDocument>('MentorSession', mentorSessionSchema);
export default MentorSession;
