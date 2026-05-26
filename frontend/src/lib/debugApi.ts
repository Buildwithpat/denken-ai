const AI_BASE = process.env.NEXT_PUBLIC_AI_SERVICE_URL ?? 'http://localhost:8000';

// ── Types ──────────────────────────────────────────────────────────────────

export interface LatencyBreakdown {
  embed_ms:  number;
  query_ms:  number;
  build_ms:  number;
  total_ms:  number;
}

export interface ChunkDebugInfo {
  rank:                number;
  chunk_id:            string;
  content:             string;
  score:               number;
  raw_semantic_score:  number;
  chunk_type:          string;
  exam:                string;
  subject:             string;
  chapter:             string;
  topic:               string | null;
  unit:                string | null;
  source:              string;
  difficulty:          string | null;
  has_diagram:         boolean;
  diagram_type:        string | null;
  diagram_description: string | null;
  keywords:            string[];
  context_bucket:      'theory' | 'formula' | 'example' | 'diagram' | 'unclassified';
}

export interface ContextGroupDebug {
  bucket: string;
  count:  number;
  items:  string[];
}

export interface RetrieveInspectRequest {
  query:            string;
  exam?:            string;
  subject?:         string;
  chapter?:         string;
  top_k?:           number;
  include_diagrams?: boolean;
}

export interface RetrieveInspectResponse {
  query:           string;
  total_found:     number;
  collection_size: number;
  latency:         LatencyBreakdown;
  chunks:          ChunkDebugInfo[];
  context_groups:  ContextGroupDebug[];
  prompt_preview:  string;
  warnings:        string[];
}

export interface OcrInspectResponse {
  filename:         string;
  ocr_engine:       string;
  raw_text:         string;
  cleaned_text:     string;
  word_count:       number;
  is_diagram_heavy: boolean;
  ocr_ms:           number;
  errors:           string[];
}

export interface SmokeTestResult {
  name:       string;
  ok:         boolean;
  latency_ms: number;
  detail:     string;
}

export interface PipelineHealthResponse {
  status:        'ok' | 'degraded' | 'down';
  collection:    string;
  total_chunks:  number;
  embedding_dim: number;
  ai_provider:   string;
  smoke_tests:   SmokeTestResult[];
  warnings:      string[];
}

export interface SimilarityRequest {
  query:      string;
  references: string[];
}

export interface SimilarityItem {
  text:  string;
  score: number;
  rank:  number;
}

export interface SimilarityResponse {
  query:    string;
  results:  SimilarityItem[];
  embed_ms: number;
}

// ── API helpers ────────────────────────────────────────────────────────────

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${AI_BASE}${path}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error((err as { detail?: string }).detail ?? 'Request failed');
  }
  return res.json() as Promise<T>;
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${AI_BASE}${path}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'Request failed' }));
    throw new Error((err as { detail?: string }).detail ?? 'Request failed');
  }
  return res.json() as Promise<T>;
}

// ── Exported API ───────────────────────────────────────────────────────────

export const debugApi = {
  retrieveInspect: (req: RetrieveInspectRequest) =>
    postJson<RetrieveInspectResponse>('/debug/retrieve-inspect', req),

  pipelineHealth: () =>
    getJson<PipelineHealthResponse>('/debug/pipeline-health'),

  similarity: (req: SimilarityRequest) =>
    postJson<SimilarityResponse>('/debug/similarity', req),

  ocrInspect: async (file: File): Promise<OcrInspectResponse> => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${AI_BASE}/debug/ocr-inspect`, {
      method: 'POST',
      body:   form,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: 'OCR request failed' }));
      throw new Error((err as { detail?: string }).detail ?? 'OCR request failed');
    }
    return res.json() as Promise<OcrInspectResponse>;
  },
};
