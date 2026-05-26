// Structured error codes returned by the backend when a feature is locked.

export type GateCode = 'FEATURE_GATED' | 'FREE_LIMIT_REACHED' | 'MODE_GATED';

export type GateFeature =
  | 'smartNotes'
  | 'aiRevision'
  | 'advancedAnalytics'
  | 'unlimitedTests'
  | 'ocr';

export interface GateEvent {
  code:     GateCode;
  feature?: GateFeature;
  mode?:    string;
  plan?:    string;
  limit?:   number;
  used?:    number;
}

/** Extract a GateEvent from an unknown caught error, or return null. */
export function parseGateEvent(err: unknown): GateEvent | null {
  if (!err || typeof err !== 'object') return null;
  const e = err as { status?: number; body?: Record<string, unknown> };
  const body = e.body;
  if (!body?.code) return null;

  const code = body.code as string;
  if (!['FEATURE_GATED', 'FREE_LIMIT_REACHED', 'MODE_GATED'].includes(code)) return null;

  return {
    code:    code as GateCode,
    feature: (body.feature as GateFeature | undefined),
    mode:    (body.mode    as string      | undefined),
    plan:    (body.plan    as string      | undefined),
    limit:   (body.limit   as number      | undefined),
    used:    (body.used    as number      | undefined),
  };
}
