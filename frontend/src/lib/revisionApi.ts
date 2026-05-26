import { api } from './api';

export interface RevisionQueueItem {
  topic: string;
  subject: string;
  /** Percent correct out of attempted */
  accuracy: number;
  /** 0–1 composite priority: errorRate×0.6 + recencyBoost×0.4 */
  priorityScore: number;
  wrongCount: number;
  totalAttempted: number;
  lastSeenAt: string;
}

export interface MistakeLogItem {
  topic: string;
  subject: string;
  wrongCount: number;
  lastSeen: string;
}

export interface RevisionPlanItem {
  day: string;
  topic: string;
  subject: string;
  duration: string;
  mode: 'concept' | 'drill' | 'practice';
  priorityLabel: 'critical' | 'high' | 'medium';
  focusPoints?: string[];
}

export interface RevisionData {
  queue:      RevisionQueueItem[];
  mistakeLog: MistakeLogItem[];
  plan:       RevisionPlanItem[];
  _tier?:     'full' | 'free';
}

export async function fetchRevision(): Promise<RevisionData> {
  return api.get<RevisionData>('/revision', { auth: true });
}
