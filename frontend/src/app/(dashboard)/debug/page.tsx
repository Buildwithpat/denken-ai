'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Activity, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp,
  ClipboardCopy, Eye, FileImage, Search, Zap,
} from 'lucide-react';
import {
  debugApi,
  type ChunkDebugInfo,
  type OcrInspectResponse,
  type PipelineHealthResponse,
  type RetrieveInspectResponse,
} from '@/lib/debugApi';

// ── Helpers ────────────────────────────────────────────────────────────────

const BUCKET_COLOR: Record<string, string> = {
  theory:       'bg-blue-500/15 text-blue-300 border-blue-500/20',
  formula:      'bg-yellow-500/15 text-yellow-300 border-yellow-500/20',
  example:      'bg-green-500/15 text-green-300 border-green-500/20',
  diagram:      'bg-purple-500/15 text-purple-300 border-purple-500/20',
  unclassified: 'bg-white/5 text-white/40 border-white/10',
};

function ScoreBar({ score }: { score: number }) {
  const pct = Math.round(score * 100);
  const color = score >= 0.6 ? '#22c55e' : score >= 0.35 ? '#eab308' : '#ef4444';
  return (
    <div className="flex items-center gap-2 min-w-[96px]">
      <div className="h-1.5 flex-1 rounded-full bg-white/10 overflow-hidden">
        <div style={{ width: `${pct}%`, backgroundColor: color }} className="h-full rounded-full transition-all" />
      </div>
      <span className="text-xs tabular-nums" style={{ color }}>{score.toFixed(3)}</span>
    </div>
  );
}

function LatencyBadge({ ms, label }: { ms: number; label: string }) {
  const color = ms < 100 ? 'text-green-400' : ms < 500 ? 'text-yellow-400' : 'text-red-400';
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`text-sm font-mono font-semibold ${color}`}>{ms.toFixed(0)}ms</span>
      <span className="text-[10px] text-white/40 uppercase tracking-wider">{label}</span>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/50 hover:text-white/80 hover:bg-white/10 transition"
    >
      <ClipboardCopy size={12} />
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

// ── Tab type ───────────────────────────────────────────────────────────────

type Tab = 'retrieve' | 'ocr' | 'health' | 'similarity';

// ── Retrieve Inspector ─────────────────────────────────────────────────────

function RetrieveTab() {
  const [query, setQuery]     = useState('');
  const [exam, setExam]       = useState('');
  const [subject, setSubject] = useState('');
  const [chapter, setChapter] = useState('');
  const [topK, setTopK]       = useState(8);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [result, setResult]   = useState<RetrieveInspectResponse | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  async function run() {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const r = await debugApi.retrieveInspect({
        query,
        exam:    exam    || undefined,
        subject: subject || undefined,
        chapter: chapter || undefined,
        top_k:   topK,
      });
      setResult(r);
      setExpanded({});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  const toggle = (i: number) => setExpanded(p => ({ ...p, [i]: !p[i] }));

  return (
    <div className="space-y-5">
      {/* Query form */}
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5 space-y-4">
        <div>
          <label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wider">Query</label>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && run()}
            placeholder="e.g. force equals mass times acceleration"
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-[#8762F7]/50"
          />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: 'Exam',    value: exam,    set: setExam,    ph: 'JEE_MAIN' },
            { label: 'Subject', value: subject, set: setSubject, ph: 'Physics'  },
            { label: 'Chapter', value: chapter, set: setChapter, ph: 'optional' },
          ].map(({ label, value, set, ph }) => (
            <div key={label}>
              <label className="block text-xs text-white/40 mb-1.5">{label}</label>
              <input
                value={value}
                onChange={e => set(e.target.value)}
                placeholder={ph}
                className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#8762F7]/50"
              />
            </div>
          ))}
          <div>
            <label className="block text-xs text-white/40 mb-1.5">Top-K</label>
            <input
              type="number"
              min={1}
              max={20}
              value={topK}
              onChange={e => setTopK(Number(e.target.value))}
              className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-white focus:outline-none focus:border-[#8762F7]/50"
            />
          </div>
        </div>
        <button
          onClick={run}
          disabled={!query.trim() || loading}
          className="flex items-center gap-2 rounded-lg bg-[#8762F7] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#7652e6] disabled:opacity-40 transition"
        >
          <Search size={14} />
          {loading ? 'Inspecting…' : 'Inspect Retrieval'}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {result && (
        <>
          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className="space-y-2">
              {result.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-4 py-2.5 text-sm text-yellow-300">
                  <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                  {w}
                </div>
              ))}
            </div>
          )}

          {/* Latency */}
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5">
            <p className="text-xs text-white/40 uppercase tracking-wider mb-4">Latency Breakdown</p>
            <div className="flex gap-8 flex-wrap">
              <LatencyBadge ms={result.latency.embed_ms} label="Embed"   />
              <LatencyBadge ms={result.latency.query_ms} label="Query"   />
              <LatencyBadge ms={result.latency.build_ms} label="Context" />
              <div className="w-px bg-white/10 self-stretch" />
              <LatencyBadge ms={result.latency.total_ms} label="Total"   />
            </div>
          </div>

          {/* Chunks */}
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
              <p className="text-xs text-white/40 uppercase tracking-wider">
                Retrieved Chunks — {result.total_found} / collection {result.collection_size}
              </p>
            </div>
            <div className="divide-y divide-white/[0.05]">
              {result.chunks.length === 0 && (
                <p className="px-5 py-4 text-sm text-white/30">No chunks returned.</p>
              )}
              {result.chunks.map((c: ChunkDebugInfo) => (
                <div key={c.rank} className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <span className="shrink-0 text-[11px] font-mono text-white/30 pt-0.5 w-5 text-right">#{c.rank}</span>
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${BUCKET_COLOR[c.context_bucket]}`}>
                          {c.chunk_type}
                        </span>
                        <span className="text-xs text-white/30">{c.subject} › {c.chapter}{c.topic ? ` › ${c.topic}` : ''}</span>
                        {c.has_diagram && (
                          <span className="text-[10px] text-purple-400 border border-purple-400/20 rounded-full px-2 py-0.5">diagram</span>
                        )}
                        {c.difficulty && (
                          <span className="text-[10px] text-white/30 border border-white/10 rounded-full px-2 py-0.5">{c.difficulty}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-white/30 uppercase tracking-wider">rank</span>
                          <ScoreBar score={c.score} />
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] text-white/30 uppercase tracking-wider">cos</span>
                          <ScoreBar score={c.raw_semantic_score} />
                        </div>
                        <button
                          onClick={() => toggle(c.rank)}
                          className="ml-auto flex items-center gap-1 text-[11px] text-white/30 hover:text-white/60 transition"
                        >
                          {expanded[c.rank] ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          {expanded[c.rank] ? 'less' : 'more'}
                        </button>
                      </div>
                      <p className="text-sm text-white/70 leading-relaxed">
                        {expanded[c.rank] ? c.content : `${c.content.slice(0, 160)}${c.content.length > 160 ? '…' : ''}`}
                      </p>
                      {expanded[c.rank] && (
                        <div className="mt-2 space-y-1.5 text-[11px] text-white/30 font-mono">
                          <p>id: {c.chunk_id || '—'}</p>
                          <p>source: {c.source} · exam: {c.exam}</p>
                          {c.keywords.length > 0 && <p>keywords: {c.keywords.join(', ')}</p>}
                          {c.diagram_description && <p>diagram: {c.diagram_description}</p>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Context groups */}
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
            <p className="px-5 py-3.5 text-xs text-white/40 uppercase tracking-wider border-b border-white/[0.06]">
              Context Builder Grouping
            </p>
            <div className="grid grid-cols-2 gap-px bg-white/[0.05]">
              {result.context_groups.map(g => (
                <div key={g.bucket} className="bg-[#0B0E14] px-5 py-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium ${BUCKET_COLOR[g.bucket] ?? BUCKET_COLOR.unclassified}`}>
                      {g.bucket}
                    </span>
                    <span className="text-xs text-white/30">{g.count} item{g.count !== 1 ? 's' : ''}</span>
                  </div>
                  {g.items.map((item, i) => (
                    <p key={i} className="text-xs text-white/50 leading-relaxed mt-1 line-clamp-2">{item}</p>
                  ))}
                  {g.count === 0 && <p className="text-xs text-white/20 italic">empty</p>}
                </div>
              ))}
            </div>
          </div>

          {/* Prompt preview */}
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
              <p className="text-xs text-white/40 uppercase tracking-wider">Prompt Preview</p>
              <CopyButton text={result.prompt_preview} />
            </div>
            <pre className="px-5 py-4 text-xs text-white/60 whitespace-pre-wrap font-mono leading-relaxed max-h-72 overflow-y-auto">
              {result.prompt_preview}
            </pre>
          </div>
        </>
      )}
    </div>
  );
}

// ── OCR Inspector ──────────────────────────────────────────────────────────

function OcrTab() {
  const inputRef            = useRef<HTMLInputElement>(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [result, setResult]     = useState<OcrInspectResponse | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function process(file: File) {
    setLoading(true);
    setError(null);
    try {
      setResult(await debugApi.ocrInspect(file));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'OCR failed');
    } finally {
      setLoading(false);
    }
  }

  function onFiles(files: FileList | null) {
    if (files?.[0]) process(files[0]);
  }

  return (
    <div className="space-y-5">
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); onFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed cursor-pointer py-12 transition
          ${dragOver ? 'border-[#8762F7] bg-[#8762F7]/10' : 'border-white/10 bg-white/[0.02] hover:border-white/20'}`}
      >
        <FileImage size={28} className="text-white/30" />
        <p className="text-sm text-white/50">Drop a PNG / JPG / WEBP here, or click to browse</p>
        <input ref={inputRef} type="file" accept=".png,.jpg,.jpeg,.webp" className="hidden" onChange={e => onFiles(e.target.files)} />
      </div>

      {loading && <p className="text-sm text-white/40 text-center">Running OCR…</p>}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {result && (
        <>
          {/* Stats row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Engine',       value: result.ocr_engine      },
              { label: 'Words',        value: String(result.word_count) },
              { label: 'OCR time',     value: `${result.ocr_ms.toFixed(0)} ms` },
              { label: 'Diagram heavy', value: result.is_diagram_heavy ? 'Yes' : 'No' },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-4 py-3">
                <p className="text-[10px] text-white/35 uppercase tracking-wider mb-1">{label}</p>
                <p className="text-sm font-medium text-white">{value}</p>
              </div>
            ))}
          </div>

          {result.errors.length > 0 && (
            <div className="space-y-1">
              {result.errors.map((e, i) => (
                <div key={i} className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  <AlertTriangle size={12} className="shrink-0 mt-0.5" />
                  {e}
                </div>
              ))}
            </div>
          )}

          {/* Raw vs Cleaned */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              { label: 'Raw OCR text',    text: result.raw_text     },
              { label: 'Cleaned text',    text: result.cleaned_text },
            ].map(({ label, text }) => (
              <div key={label} className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
                  <p className="text-xs text-white/40 uppercase tracking-wider">{label}</p>
                  <CopyButton text={text} />
                </div>
                <pre className="px-4 py-4 text-xs text-white/60 whitespace-pre-wrap font-mono leading-relaxed max-h-52 overflow-y-auto">
                  {text || <span className="italic text-white/20">(empty)</span>}
                </pre>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ── Pipeline Health ────────────────────────────────────────────────────────

function HealthTab() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [result, setResult]   = useState<PipelineHealthResponse | null>(null);

  async function check() {
    setLoading(true);
    setError(null);
    try {
      setResult(await debugApi.pipelineHealth());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Health check failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { check(); }, []);

  const STATUS_COLOR = {
    ok:       'text-green-400 border-green-400/20 bg-green-400/10',
    degraded: 'text-yellow-400 border-yellow-400/20 bg-yellow-400/10',
    down:     'text-red-400 border-red-400/20 bg-red-400/10',
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <button
          onClick={check}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-white/70 hover:bg-white/[0.08] hover:text-white disabled:opacity-40 transition"
        >
          <Activity size={14} />
          {loading ? 'Checking…' : 'Re-check'}
        </button>
        {result && (
          <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium ${STATUS_COLOR[result.status]}`}>
            {result.status === 'ok' ? <CheckCircle2 size={13} /> : <AlertTriangle size={13} />}
            {result.status.toUpperCase()}
          </span>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {result && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: 'Collection',     value: result.collection    },
              { label: 'Total chunks',   value: String(result.total_chunks) },
              { label: 'Embedding dim',  value: String(result.embedding_dim) },
              { label: 'AI provider',    value: result.ai_provider   },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-4 py-3">
                <p className="text-[10px] text-white/35 uppercase tracking-wider mb-1">{label}</p>
                <p className="text-sm font-medium text-white truncate">{value}</p>
              </div>
            ))}
          </div>

          {/* Smoke tests */}
          <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
            <p className="px-5 py-3.5 text-xs text-white/40 uppercase tracking-wider border-b border-white/[0.06]">Smoke Tests</p>
            <div className="divide-y divide-white/[0.05]">
              {result.smoke_tests.map(t => (
                <div key={t.name} className="flex items-center gap-4 px-5 py-3.5">
                  {t.ok
                    ? <CheckCircle2 size={15} className="shrink-0 text-green-400" />
                    : <AlertTriangle size={15} className="shrink-0 text-red-400" />
                  }
                  <span className="text-sm font-medium text-white w-24 shrink-0">{t.name}</span>
                  <span className="text-xs text-white/40 flex-1">{t.detail}</span>
                  <span className={`text-xs font-mono tabular-nums ${t.latency_ms < 200 ? 'text-green-400' : t.latency_ms < 800 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {t.latency_ms.toFixed(0)} ms
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className="space-y-2">
              {result.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2 rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-4 py-2.5 text-sm text-yellow-300">
                  <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                  {w}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ── Similarity ─────────────────────────────────────────────────────────────

function SimilarityTab() {
  const [query, setQuery]   = useState('');
  const [refs, setRefs]     = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [result, setResult] = useState<{ query: string; results: { text: string; score: number; rank: number }[]; embed_ms: number } | null>(null);

  async function run() {
    const refList = refs.split('\n').map(r => r.trim()).filter(Boolean);
    if (!query.trim() || refList.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await debugApi.similarity({ query, references: refList }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Similarity failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-5 space-y-4">
        <div>
          <label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wider">Query</label>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="e.g. Newton second law of motion"
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-[#8762F7]/50"
          />
        </div>
        <div>
          <label className="block text-xs text-white/40 mb-1.5 uppercase tracking-wider">Reference texts (one per line, max 20)</label>
          <textarea
            value={refs}
            onChange={e => setRefs(e.target.value)}
            rows={6}
            placeholder={"The net force on a body equals mass times acceleration.\nKinetic energy = ½mv²\n..."}
            className="w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[#8762F7]/50 font-mono resize-none"
          />
        </div>
        <button
          onClick={run}
          disabled={!query.trim() || !refs.trim() || loading}
          className="flex items-center gap-2 rounded-lg bg-[#8762F7] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#7652e6] disabled:opacity-40 transition"
        >
          <Zap size={14} />
          {loading ? 'Computing…' : 'Compute Similarity'}
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {result && (
        <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06]">
            <p className="text-xs text-white/40 uppercase tracking-wider">Scores — ranked by similarity</p>
            <span className="text-xs text-white/30 font-mono">{result.embed_ms.toFixed(0)} ms</span>
          </div>
          <div className="divide-y divide-white/[0.05]">
            {result.results.map(r => (
              <div key={r.rank} className="flex items-center gap-4 px-5 py-3.5">
                <span className="text-xs font-mono text-white/25 w-4 shrink-0">#{r.rank}</span>
                <p className="flex-1 text-sm text-white/70 min-w-0">{r.text}</p>
                <ScoreBar score={r.score} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'retrieve',   label: 'Retrieve Inspector', icon: <Search size={14} /> },
  { id: 'ocr',        label: 'OCR Inspector',       icon: <Eye size={14} />    },
  { id: 'health',     label: 'Pipeline Health',     icon: <Activity size={14} /> },
  { id: 'similarity', label: 'Similarity',          icon: <Zap size={14} />    },
];

export default function DebugPage() {
  const [tab, setTab] = useState<Tab>('health');

  return (
    <div className="min-h-screen bg-[#0B0E14] text-white">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="rounded-lg border border-[#8762F7]/30 bg-[#8762F7]/15 p-2">
              <Activity size={18} className="text-[#8762F7]" />
            </div>
            <h1 className="text-xl font-semibold text-white">RAG Observability Console</h1>
          </div>
          <p className="text-sm text-white/40 ml-11">Inspect retrieval pipeline, OCR extraction, and similarity scores in real-time.</p>
        </div>

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-xl border border-white/[0.07] bg-white/[0.02] p-1">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 flex-1 justify-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all
                ${tab === t.id
                  ? 'bg-[#8762F7]/20 text-white shadow-[0_0_10px_rgba(135,98,247,0.15)]'
                  : 'text-white/40 hover:text-white/70'
                }`}
            >
              <span className={tab === t.id ? 'text-[#8762F7]' : ''}>{t.icon}</span>
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Panel */}
        {tab === 'retrieve'   && <RetrieveTab   />}
        {tab === 'ocr'        && <OcrTab        />}
        {tab === 'health'     && <HealthTab     />}
        {tab === 'similarity' && <SimilarityTab />}
      </div>
    </div>
  );
}
