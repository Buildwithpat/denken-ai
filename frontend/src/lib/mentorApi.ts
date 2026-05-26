import { api } from './api';

// ── Response types ────────────────────────────────────────────────────────────

export interface MentorResponse {
  answer:          string;
  key_points:      string[];
  related_topics:  string[];
  formula_refs:    string[];
  suggestions:     string[];
  generated_by:    string;
  rag_chunks_used: number;
  intent_detected: string;
}

export interface SessionMessage {
  role:      'user' | 'assistant';
  content:   string;
  intent:    string;
  chapter:   string | null;
  subject:   string | null;
  createdAt: string;
}

export interface IdentifiedWeakness {
  topic:       string;
  subject:     string;
  mistakeType: string;
  occurrences: number;
  aiInsight:   string;
}

export interface MentorSession {
  messages:             SessionMessage[];
  identifiedWeaknesses: IdentifiedWeakness[];
  totalInteractions:    number;
}

// ── API calls ─────────────────────────────────────────────────────────────────

export async function sendMentorMessage(
  message:  string,
  chapter?: string | null,
  subject?: string | null,
  exam?:    string,
  intent?:  string | null,
): Promise<MentorResponse> {
  return api.post<MentorResponse>(
    '/mentor/chat',
    { message, chapter: chapter ?? null, subject: subject ?? null, exam: exam ?? 'JEE_MAIN', intent: intent ?? null },
    { auth: true },
  );
}

export async function fetchMentorSession(): Promise<MentorSession> {
  return api.get<MentorSession>('/mentor/session', { auth: true });
}
