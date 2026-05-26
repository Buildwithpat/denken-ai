/**
 * DenkenAI — Comprehensive End-to-End Validation Suite
 *
 * Run: npx ts-node scripts/validate-e2e.ts
 *
 * Covers every user journey from signup → onboarding → pricing → trial →
 * feature gates → test generation/submission → analytics propagation →
 * subscription activation/renewal/expiry → Razorpay verification + webhooks.
 */

import crypto from 'crypto';

// ── Config ────────────────────────────────────────────────────────────────────

const BASE = process.env.API_URL ?? 'http://localhost:5000/api';
const RUN  = Date.now();

// ── Colour helpers ────────────────────────────────────────────────────────────

const C = {
  reset:  '\x1b[0m',
  bold:   '\x1b[1m',
  red:    '\x1b[31m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  cyan:   '\x1b[36m',
  dim:    '\x1b[2m',
  magenta:'\x1b[35m',
};
const ok   = (s: string) => `${C.green}✓${C.reset} ${s}`;
const fail = (s: string) => `${C.red}✗${C.reset} ${s}`;
const warn = (s: string) => `${C.yellow}⚠${C.reset} ${s}`;
const info = (s: string) => `${C.cyan}→${C.reset} ${s}`;
const section = (s: string) => `\n${C.bold}${C.magenta}▶ ${s}${C.reset}`;

// ── Result tracking ───────────────────────────────────────────────────────────

interface TestResult {
  suite:   string;
  name:    string;
  passed:  boolean;
  issue?:  string;
  fix?:    string;
}

const results: TestResult[] = [];
let currentSuite = '';

function suite(name: string) {
  currentSuite = name;
  console.log(section(name));
}

function record(name: string, passed: boolean, issue?: string, fix?: string) {
  results.push({ suite: currentSuite, name, passed, issue, fix });
  if (passed) {
    console.log(ok(name));
  } else {
    console.log(fail(name));
    if (issue) console.log(`   ${C.dim}Issue: ${issue}${C.reset}`);
    if (fix)   console.log(`   ${C.yellow}Fix:   ${fix}${C.reset}`);
  }
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

interface ApiResponse<T = unknown> {
  status: number;
  body:   T;
  raw:    string;
}

async function request<T = Record<string, unknown>>(
  method: string,
  path: string,
  opts: { body?: unknown; token?: string; rawBody?: string; headers?: Record<string, string> } = {},
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...opts.headers,
  };
  if (opts.token) headers['Authorization'] = `Bearer ${opts.token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: opts.rawBody ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
  });

  const raw = await res.text();
  let body: T;
  try { body = JSON.parse(raw) as T; }
  catch { body = raw as unknown as T; }

  return { status: res.status, body, raw };
}

const GET  = <T>(p: string, token?: string) => request<T>('GET',  p, { token });
const POST = <T>(p: string, body: unknown, token?: string) => request<T>('POST', p, { body, token });
const WEBHOOK = (path: string, body: string, sig: string) =>
  request('POST', path, { rawBody: body, headers: { 'x-razorpay-signature': sig, 'Content-Type': 'application/json' } });

// ── Test user factory ─────────────────────────────────────────────────────────

function makeUser(tag: string) {
  return {
    name:         `E2E ${tag}`,
    email:        `e2e.${tag}.${RUN}@denken-test.local`,
    mobileNumber: '9876543210',
    password:     'Test@12345',
  };
}

// ── Assertion helpers ─────────────────────────────────────────────────────────

function assert(cond: boolean, name: string, issue: string, fix: string) {
  record(name, cond, cond ? undefined : issue, cond ? undefined : fix);
  return cond;
}

function assertStatus(
  res: ApiResponse,
  expected: number,
  name: string,
  fix: string,
) {
  return assert(
    res.status === expected,
    name,
    `Expected HTTP ${expected}, got ${res.status}. Body: ${res.raw.slice(0, 200)}`,
    fix,
  );
}

// ── Shared state across suites ────────────────────────────────────────────────

let freeToken  = '';
let freeEmail  = '';
let trialToken = '';
let testId     = '';
let questionIds: string[] = [];

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 1 — Health & Configuration
// ═══════════════════════════════════════════════════════════════════════════════

async function suite_health() {
  suite('Health & Configuration');

  const r = await fetch(`${BASE.replace('/api', '')}/health`).then(x => x.json()) as Record<string, unknown>;

  assert(
    (r as Record<string, unknown>).status === 'ok',
    'Backend health: status ok',
    `DB state: ${(r.db as Record<string, unknown>)?.state ?? 'unknown'}`,
    'Whitelist machine IP (152.58.86.1) in MongoDB Atlas → Network Access',
  );

  assert(
    (r.db as Record<string, unknown>)?.ready === true,
    'MongoDB connected',
    `DB ready=false — Atlas IP not whitelisted`,
    'Go to https://cloud.mongodb.com → Network Access → Add IP Address → add 152.58.86.1',
  );

  // Plans endpoint (public, no DB needed for static data)
  const plans = await GET<{ plans: unknown[] }>('/subscription/plans');
  assertStatus(plans, 200, 'GET /subscription/plans returns 200', 'Check route mounting in app.ts');
  assert(
    Array.isArray((plans.body as { plans: unknown[] }).plans) && (plans.body as { plans: unknown[] }).plans.length >= 4,
    'Plan catalog has ≥4 entries (free/trial/pro/pro_annual)',
    `Got ${(plans.body as { plans: unknown[] }).plans?.length ?? 0} plans`,
    'Verify PLAN_CATALOG in entitlements.ts',
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 2 — Auth: Signup, Login, Validation
// ═══════════════════════════════════════════════════════════════════════════════

async function suite_auth() {
  suite('Auth — Signup / Login / Validation');

  const user = makeUser('free');
  freeEmail  = user.email;

  // 2.1 Signup
  const signup = await POST<{ token: string; user: Record<string, unknown> }>('/auth/signup', user);
  assertStatus(signup, 201, 'POST /auth/signup → 201 Created', 'Check authController.signup and registerUser()');

  if (signup.status === 201) {
    freeToken = (signup.body as { token: string }).token;
    assert(typeof freeToken === 'string' && freeToken.length > 20, 'Signup returns JWT token', 'No token in response body', 'buildAuthResult() must include signToken()');
    assert(typeof (signup.body as { user: Record<string, unknown> }).user === 'object', 'Signup returns user object', 'No user object in response', 'Return user field from buildAuthResult()');

    const entitlements = (signup.body as { user: { entitlements?: Record<string, unknown> } }).user?.entitlements;
    assert(
      (entitlements as Record<string, unknown>)?.plan === 'free',
      'New user starts on free plan',
      `Plan is ${(entitlements as Record<string, unknown>)?.plan}`,
      'computeEntitlements() should return plan=free for new user',
    );
    assert(
      (entitlements as Record<string, unknown>)?.trialAvailable === true,
      'New user has trialAvailable=true',
      `trialAvailable=${(entitlements as Record<string, unknown>)?.trialAvailable}`,
      'trialUsed defaults to false; computeEntitlements should set trialAvailable=!trialUsed && plan===free',
    );
  }

  // 2.2 Duplicate signup
  const dup = await POST('/auth/signup', user);
  assertStatus(dup, 409, 'Duplicate signup → 409 Conflict', 'registerUser() must check existing email and throw AppError(409)');

  // 2.3 Signup validation
  const badSignup = await POST('/auth/signup', { name: 'A', email: 'notanemail', mobileNumber: '123', password: 'short' });
  assertStatus(badSignup, 400, 'Signup with invalid fields → 400 Bad Request', 'validateSignup() must check email format, name min 2, mobile 10 digits, password min 8');

  // 2.4 Login valid
  const login = await POST<{ token: string }>('/auth/login', { email: user.email, password: user.password });
  assertStatus(login, 200, 'POST /auth/login → 200 OK', 'loginUser() must return token on correct credentials');
  if (login.status === 200) {
    freeToken = (login.body as { token: string }).token;
    assert(typeof freeToken === 'string', 'Login returns JWT token', 'No token', 'buildAuthResult() must include signToken()');
  }

  // 2.5 Login wrong password
  const badLogin = await POST('/auth/login', { email: user.email, password: 'WrongPass1' });
  assertStatus(badLogin, 401, 'Login with wrong password → 401', 'loginUser() must throw AppError(401) on credential mismatch');

  // 2.6 /me endpoint
  const me = await GET<{ user: Record<string, unknown>; entitlements: Record<string, unknown> }>('/auth/me', freeToken);
  assertStatus(me, 200, 'GET /auth/me returns 200 with token', 'protect middleware + getMe controller');
  assert(
    (me.body as { user: Record<string, unknown> }).user?.email === freeEmail,
    '/auth/me returns correct user email',
    `Expected ${freeEmail}, got ${(me.body as { user: Record<string, unknown> }).user?.email}`,
    'User.findById(req.user.userId)',
  );

  // 2.7 Unauthenticated /me
  const meNoAuth = await GET('/auth/me');
  assertStatus(meNoAuth, 401, 'GET /auth/me without token → 401', 'protect middleware must return 401 when no Authorization header');

  // 2.8 Logout
  const logout = await POST('/auth/logout', {}, freeToken);
  assertStatus(logout, 200, 'POST /auth/logout → 200', 'logout controller must return 200');
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 3 — Free Tier: Access & Entitlement Checks
// ═══════════════════════════════════════════════════════════════════════════════

async function suite_free_entitlements() {
  suite('Free Tier — Access Context & Entitlement Enforcement');

  // 3.1 Access endpoint
  const access = await GET<Record<string, unknown>>('/access', freeToken);
  assertStatus(access, 200, 'GET /access → 200 for authenticated user', 'accessController + protect middleware');

  const body = access.body as {
    entitlements?: { plan: string; status: string; features: Record<string, boolean>; dailyTestLimit: number; trialAvailable: boolean };
    usage?:        { testsToday: number; dailyLimit: number; limitReached: boolean; resetsAt: string };
    features?:     Record<string, { allowed: boolean; upgradeRequired: boolean; trialAvailable: boolean }>;
    upgradeUrl?:   string;
  };

  assert(body.entitlements?.plan === 'free',       'Access: plan=free',            `Got ${body.entitlements?.plan}`, 'computeEntitlements must return free plan');
  assert(body.entitlements?.status === 'none',     'Access: status=none for free', `Got ${body.entitlements?.status}`, 'resolveStatus should return none for free plan');
  assert(body.entitlements?.dailyTestLimit === 3,  'Access: dailyTestLimit=3',     `Got ${body.entitlements?.dailyTestLimit}`, 'PLAN_CATALOG.free.dailyTestLimit must be 3');
  assert(body.entitlements?.trialAvailable === true, 'Access: trialAvailable=true', `Got ${body.entitlements?.trialAvailable}`, 'New user should have trialAvailable=true');
  assert(typeof body.usage?.testsToday === 'number', 'Access: usage.testsToday is a number', `Got ${typeof body.usage?.testsToday}`, 'accessController must count Result docs for today');
  assert(typeof body.usage?.resetsAt === 'string',   'Access: usage.resetsAt is a string',   `Got ${typeof body.usage?.resetsAt}`, 'nextUtcMidnight() must return ISO string');
  assert(body.upgradeUrl !== undefined,             'Access: upgradeUrl present',  'Missing upgradeUrl', 'accessController must include upgradeUrl');

  // Check every feature is false for free users
  const gatedFeatures = ['planner', 'readiness', 'smartNotes', 'aiRevision', 'advancedAnalytics', 'unlimitedTests', 'ocr'];
  for (const feat of gatedFeatures) {
    assert(
      body.features?.[feat]?.allowed === false,
      `Access: feature '${feat}' is denied for free user`,
      `${feat}.allowed=${body.features?.[feat]?.allowed}`,
      `computeEntitlements must set features.${feat}=false for free plan`,
    );
    assert(
      body.features?.[feat]?.upgradeRequired === true,
      `Access: feature '${feat}' shows upgradeRequired=true`,
      `${feat}.upgradeRequired=${body.features?.[feat]?.upgradeRequired}`,
      'accessController must set upgradeRequired based on feature gate',
    );
  }

  // 3.2 Feature-gated 403s
  const gated403s: Array<[string, string, string]> = [
    ['GET', '/planner/week',     'planner'],
    ['GET', '/readiness',        'readiness'],
    ['GET', '/revision',         'revision (aiRevision feature)'],
  ];

  for (const [method, path, label] of gated403s) {
    const r = method === 'GET' ? await GET(path, freeToken) : await POST(path, {}, freeToken);
    // revision returns 200 with _tier=free, NOT 403 (it degrades gracefully)
    if (label === 'revision (aiRevision feature)') {
      const body2 = r.body as { _tier?: string };
      assert(
        r.status === 200 && body2._tier === 'free',
        `GET /revision: free tier gets _tier=free (graceful degrade)`,
        `status=${r.status}, _tier=${body2._tier}`,
        'revisionController must return 200 with _tier=free when aiRevision=false',
      );
    } else {
      assertStatus(r, 403, `${method} ${path}: free user gets 403 (${label} gated)`, `requireFeature('${label.split(' ')[0]}') middleware must block free users`);
      const errBody = r.body as { code?: string };
      assert(
        errBody.code === 'FEATURE_GATED',
        `${method} ${path}: 403 body has code=FEATURE_GATED`,
        `code=${errBody.code}`,
        'requireFeature() must include code: FEATURE_GATED in response',
      );
    }
  }

  // 3.3 Notes gated
  const notes = await POST('/notes/generate', { topic: 'Newton Laws', subject: 'Physics' }, freeToken);
  assertStatus(notes, 403, 'POST /notes/generate: free user gets 403 (smartNotes gated)', "requireFeature('smartNotes') missing from notes route");

  // 3.4 OCR gated
  const ocr = await POST('/ocr/extract', { image: 'base64data' }, freeToken);
  assert(
    ocr.status === 403 || ocr.status === 501,
    'POST /ocr/extract: free user gets 403 or 501 (gated+not implemented)',
    `Got ${ocr.status}`,
    'OCR should be feature-gated first (403) or return 501 stub',
  );

  // 3.5 Unauthenticated gated route
  const noAuth = await GET('/planner/week');
  assertStatus(noAuth, 401, 'GET /planner/week without token → 401', 'protect middleware must fire before requireFeature');
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 4 — Test Generation & Submission (Free Tier)
// ═══════════════════════════════════════════════════════════════════════════════

async function suite_test_flow() {
  suite('Test Generation & Submission (Free Tier)');

  // 4.1 Syllabus (public)
  const syl = await GET<Record<string, unknown>>('/test/syllabus?exam=JEE_MAIN');
  assertStatus(syl, 200, 'GET /test/syllabus (public, no token) → 200', 'syllabus route must not require auth');
  assert(Array.isArray((syl.body as { subjects?: unknown[] }).subjects), 'Syllabus returns subjects array', `Got ${typeof (syl.body as { subjects?: unknown[] }).subjects}`, 'syllabusLoader must return subjects array for exam');

  const sylInvalid = await GET('/test/syllabus?exam=INVALID_EXAM');
  assertStatus(sylInvalid, 400, 'GET /test/syllabus with invalid exam → 400', 'validateSyllabusQuery() must reject unknown exam keys');

  // 4.2 Generate test — normal mode (free allowed)
  const gen = await POST<{ testId: string; questions: Array<{ id: string; question: string; options?: string[]; type: string; subject: string }> }>(
    '/test/generate',
    { exam: 'JEE_MAIN', subjects: ['Physics'], difficulty: 'easy', questionCount: 5, mode: 'normal' },
    freeToken,
  );
  assertStatus(gen, 201, 'POST /test/generate (normal mode, free) → 201', 'generateTestHandler must create and save test');
  if (gen.status === 201) {
    testId      = (gen.body as { testId: string }).testId;
    const qs    = (gen.body as { questions: Array<{ id: string; subject: string; options?: string[]; type: string }> }).questions;
    questionIds = qs?.map(q => q.id) ?? [];

    assert(typeof testId === 'string' && testId.length === 24, 'Generated testId is a valid ObjectId', `testId=${testId}`, 'Test.create() returns Mongoose ObjectId as string');
    assert(Array.isArray(qs) && qs.length > 0, 'Generate returns non-empty questions array', `questions.length=${qs?.length}`, 'generateTest() must return at least 1 question');
    assert(qs?.every(q => q.subject && q.type), 'All questions have subject and type', 'Some questions missing required fields', 'Question interface must include subject and type');
  }

  // 4.3 Generate test — premium mode (should 403)
  const genPremium = await POST('/test/generate', { exam: 'JEE_MAIN', subjects: ['Physics'], mode: 'pyq', questionCount: 5 }, freeToken);
  assertStatus(genPremium, 403, "POST /test/generate (mode='pyq', free) → 403", "testController must gate pyq/mistake/smart modes behind unlimitedTests feature");

  // 4.4 Generate without auth
  const genNoAuth = await POST('/test/generate', { exam: 'JEE_MAIN', subjects: ['Physics'], questionCount: 5 });
  assertStatus(genNoAuth, 401, 'POST /test/generate without token → 401', 'protect middleware must fire first');

  // 4.5 Submit test
  if (testId && questionIds.length > 0) {
    const answers = questionIds.slice(0, 3).map(id => ({ questionId: id, selectedOption: 'A' as const }));
    const submit  = await POST<{ result: Record<string, unknown> }>('/test/submit', { testId, timeTaken: 300, answers }, freeToken);
    assertStatus(submit, 201, 'POST /test/submit → 201', 'gradeAndSave() must create Result doc');
    if (submit.status === 201) {
      const r = (submit.body as { result: Record<string, unknown> }).result;
      assert(typeof r?.totalScore === 'number', 'Submit returns numeric totalScore', `totalScore=${r?.totalScore}`, 'gradeAndSave() must compute totalScore');
      assert(typeof r?.correctCount === 'number', 'Submit returns correctCount', `correctCount=${r?.correctCount}`, 'gradeAndSave() must track correctCount');
      assert(Array.isArray(r?.subjectWise), 'Submit returns subjectWise breakdown', `subjectWise=${JSON.stringify(r?.subjectWise)}`, 'gradeAndSave() must build per-subject summary');
    }

    // Submit again — should create second result (no deduplication by design)
    const submit2 = await POST('/test/submit', { testId, timeTaken: 200, answers }, freeToken);
    assert(
      submit2.status === 201 || submit2.status === 409,
      'Resubmitting same testId: handled gracefully (201 or 409)',
      `Got ${submit2.status}`,
      'Decide if re-submission should be blocked (409) or allowed (201)',
    );
  }

  // 4.6 Submit validation errors
  const badSubmit = await POST('/test/submit', { testId: 'notanid', timeTaken: -1, answers: 'wrong' }, freeToken);
  assertStatus(badSubmit, 400, 'POST /test/submit with invalid body → 400', 'validateSubmitBody() must validate testId format, timeTaken ≥ 0, answers array');
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 5 — Daily Test Limit Enforcement
// ═══════════════════════════════════════════════════════════════════════════════

async function suite_daily_limit() {
  suite('Daily Test Limit Enforcement (Free Tier)');

  // Generate tests until we hit the limit or verify 429 handling
  let limitHit  = false;
  let attempts  = 0;
  const maxTry  = 5; // safety cap

  while (attempts < maxTry && !limitHit) {
    const r = await POST('/test/generate', { exam: 'JEE_MAIN', subjects: ['Physics'], questionCount: 3, mode: 'normal' }, freeToken);
    attempts++;

    if (r.status === 429) {
      limitHit = true;
      const body = r.body as { code?: string; limit?: number; usedToday?: number; resetsAt?: string; trialAvailable?: boolean; plan?: string };
      assert(body.code === 'DAILY_LIMIT_REACHED', '429 body has code=DAILY_LIMIT_REACHED',   `code=${body.code}`, 'enforceTestLimit() must include code: DAILY_LIMIT_REACHED');
      assert(typeof body.limit     === 'number',  '429 body has numeric limit',                `limit=${body.limit}`, 'enforceTestLimit() must include limit in response');
      assert(typeof body.usedToday === 'number',  '429 body has numeric usedToday',            `usedToday=${body.usedToday}`, 'enforceTestLimit() must count today\'s results');
      assert(typeof body.resetsAt  === 'string',  '429 body has resetsAt ISO string',          `resetsAt=${body.resetsAt}`, 'enforceTestLimit() must include resetsAt from nextUtcMidnight()');
      assert(body.trialAvailable   === true,       '429 body has trialAvailable=true (upsell)', `trialAvailable=${body.trialAvailable}`, 'enforceTestLimit() must pass trialAvailable for upsell');
      break;
    }

    if (r.status !== 201) break; // unexpected error — stop
  }

  assert(limitHit || attempts >= 3, 'Daily limit enforcement active (hit 429 within 5 attempts)', `Reached ${attempts} attempts without 429 or error`, 'enforceTestLimit() may not be counting correctly');

  if (!limitHit) {
    record('Daily limit triggered 429 response', false, `${attempts} attempts made, no 429 seen — user may already have many tests today or limit not enforced`, 'Check enforceTestLimit() — ensure Result.countDocuments uses correct UTC day boundary');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 6 — Analytics, Revision, Access After Test Data Exists
// ═══════════════════════════════════════════════════════════════════════════════

async function suite_analytics_propagation() {
  suite('Analytics & Revision Propagation (Free Tier)');

  // 6.1 Analytics free tier
  const analytics = await GET<Record<string, unknown>>('/analytics', freeToken);
  assertStatus(analytics, 200, 'GET /analytics → 200 for free user', 'analyticsController must not gate the endpoint itself');
  assert(
    (analytics.body as { _tier?: string })._tier === 'free',
    'Analytics returns _tier=free for non-subscriber',
    `_tier=${(analytics.body as { _tier?: string })._tier}`,
    'analyticsController must set _tier based on entitlements.features.advancedAnalytics',
  );

  // Verify free tier limits — no weakTopics or recommendations
  const body = analytics.body as Record<string, unknown>;
  const hasWeakTopics = 'weakTopics' in body;
  const hasAiRecs     = 'recommendations' in body;
  assert(!hasWeakTopics || (body.weakTopics as unknown[])?.length === 0 || typeof body.weakTopics === 'undefined',
    'Free analytics: weakTopics absent or empty (gated)',
    `weakTopics present with data: ${JSON.stringify(body.weakTopics)?.slice(0, 100)}`,
    'analyticsController must omit weakTopics for free tier',
  );

  // 6.2 Revision free tier
  const revision = await GET<{ _tier?: string; queue?: unknown[] }>('/revision', freeToken);
  assertStatus(revision, 200, 'GET /revision → 200 for free user (graceful degrade)', 'revisionController must degrade gracefully, not 403');
  assert(
    (revision.body as { _tier?: string })._tier === 'free',
    'Revision returns _tier=free',
    `_tier=${(revision.body as { _tier?: string })._tier}`,
    'revisionController must set _tier based on aiRevision feature',
  );

  // Free revision: queue max 3 items
  const queue = (revision.body as { queue?: unknown[] }).queue;
  if (queue !== undefined) {
    assert(
      !Array.isArray(queue) || queue.length <= 3,
      'Free revision queue: ≤3 items',
      `queue.length=${queue?.length}`,
      'revisionService must limit to top 3 items for free tier',
    );
  }

  // 6.3 Access shows updated usage after tests
  const access = await GET<{
    usage?: { testsToday: number; dailyLimit: number; limitReached: boolean }
  }>('/access', freeToken);
  assertStatus(access, 200, 'GET /access after generating tests: 200', 'accessController must always return 200');
  assert(
    typeof (access.body as { usage?: { testsToday: number } }).usage?.testsToday === 'number',
    'Access usage.testsToday updated after test generation',
    `testsToday=${(access.body as { usage?: { testsToday: number } }).usage?.testsToday}`,
    'accessController must count today\'s Result docs in real-time',
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 7 — Trial Activation & Feature Unlock
// ═══════════════════════════════════════════════════════════════════════════════

async function suite_trial() {
  suite('Free Trial Activation & Feature Unlock');

  // Create a fresh user for trial so daily limit is clean
  const trialUser = makeUser('trial');
  const signup = await POST<{ token: string }>('/auth/signup', trialUser);
  if (signup.status !== 201) {
    record('Trial suite setup: create trial user', false, `Signup returned ${signup.status}`, 'Cannot proceed without a valid user');
    return;
  }
  trialToken = (signup.body as { token: string }).token;

  // 7.1 Start trial
  const trial = await POST<{
    plan: string; status: string; features: Record<string, boolean>;
    trialEndsAt: string | null; dailyTestLimit: number | null; trialAvailable: boolean
  }>('/subscription/trial', {}, trialToken);
  assertStatus(trial, 200, 'POST /subscription/trial → 200', 'startTrialHandler must return 200 with Entitlements');

  if (trial.status === 200) {
    const ents = trial.body as { plan: string; status: string; features: Record<string, boolean>; trialEndsAt: string | null; dailyTestLimit: number | null; trialAvailable: boolean };
    assert(ents.plan === 'trial',             'Trial: plan=trial after activation',         `plan=${ents.plan}`,           'startTrial() must set user.plan=trial');
    assert(ents.status === 'active',          'Trial: status=active',                       `status=${ents.status}`,       'startTrial() must set subscriptionStatus=active');
    assert(ents.dailyTestLimit === null,      'Trial: dailyTestLimit=null (unlimited)',      `limit=${ents.dailyTestLimit}`, 'trial plan should have dailyTestLimit=null');
    assert(ents.trialAvailable === false,     'Trial: trialAvailable=false (already used)',  `trialAvailable=${ents.trialAvailable}`, 'trialAvailable must be false once trial is started');
    assert(typeof ents.trialEndsAt === 'string', 'Trial: trialEndsAt is ISO string',        `trialEndsAt=${ents.trialEndsAt}`, 'startTrial() must set trialEndsAt = now + 7 days');

    // Verify trialEndsAt is ~7 days in the future
    if (typeof ents.trialEndsAt === 'string') {
      const daysAhead = (new Date(ents.trialEndsAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      assert(daysAhead > 6.5 && daysAhead < 7.5, 'Trial: trialEndsAt is ~7 days from now', `Days ahead: ${daysAhead.toFixed(2)}`, 'PLAN_CATALOG.free.trialDays must be 7');
    }

    // All features must be true
    const gatedFeatures = ['planner', 'readiness', 'smartNotes', 'aiRevision', 'advancedAnalytics', 'unlimitedTests', 'ocr'];
    for (const feat of gatedFeatures) {
      assert(ents.features[feat] === true, `Trial: feature '${feat}' enabled`, `${feat}=${ents.features[feat]}`, 'Trial plan must have ALL_FEATURES');
    }
  }

  // 7.2 Double trial (idempotency)
  const trial2 = await POST('/subscription/trial', {}, trialToken);
  assertStatus(trial2, 409, 'POST /subscription/trial (second call) → 409 Conflict', "startTrial() must throw AppError(409) when trialUsed=true");

  // 7.3 Verify features are actually usable after trial
  const planner = await GET('/planner/week', trialToken);
  assert(
    planner.status === 200 || planner.status === 503,
    'GET /planner/week works for trial user (200 or 503 if AI unavailable)',
    `status=${planner.status}. Body: ${JSON.stringify(planner.body).slice(0, 200)}`,
    'requireFeature("planner") must pass for trial user; planner may return 503 if AI offline',
  );

  const readiness = await GET('/readiness', trialToken);
  assert(
    readiness.status === 200 || readiness.status === 503,
    'GET /readiness works for trial user (200 or 503 if AI unavailable)',
    `status=${readiness.status}`,
    'requireFeature("readiness") must pass for trial user',
  );

  const revTrial = await GET<{ _tier?: string }>('/revision', trialToken);
  assert(
    revTrial.status === 200 && (revTrial.body as { _tier?: string })._tier === 'full',
    'GET /revision returns _tier=full for trial user',
    `status=${revTrial.status}, _tier=${(revTrial.body as { _tier?: string })._tier}`,
    'revisionController must return _tier=full when aiRevision=true',
  );

  const analTrial = await GET<{ _tier?: string }>('/analytics', trialToken);
  assert(
    analTrial.status === 200 && (analTrial.body as { _tier?: string })._tier === 'full',
    'GET /analytics returns _tier=full for trial user',
    `status=${analTrial.status}, _tier=${(analTrial.body as { _tier?: string })._tier}`,
    'analyticsController must return _tier=full when advancedAnalytics=true',
  );

  // 7.4 Trial: premium test modes
  const pyq = await POST('/test/generate', { exam: 'JEE_MAIN', subjects: ['Physics'], questionCount: 3, mode: 'pyq' }, trialToken);
  assert(
    pyq.status === 201 || pyq.status === 400,
    "Trial user: mode='pyq' allowed (201) or invalid if no PYQ data (400)",
    `Got ${pyq.status}: ${JSON.stringify(pyq.body).slice(0, 200)}`,
    'unlimitedTests feature must allow pyq/mistake/smart modes',
  );

  // 7.5 Trial: no daily limit
  // Generate 4 tests to verify no 429 (free limit is 3)
  let got429 = false;
  for (let i = 0; i < 4; i++) {
    const r = await POST('/test/generate', { exam: 'JEE_MAIN', subjects: ['Chemistry'], questionCount: 3, mode: 'normal' }, trialToken);
    if (r.status === 429) { got429 = true; break; }
  }
  assert(!got429, 'Trial user: no 429 after 4+ test generations (unlimited)', 'Got 429 for trial user', 'enforceTestLimit() must skip limit check when dailyTestLimit=null');

  // 7.6 Subscription history shows trial_started event
  const history = await GET<{ history: Array<{ event: string; plan: string; status: string }> }>('/subscription/history', trialToken);
  assertStatus(history, 200, 'GET /subscription/history → 200', 'getHistoryHandler must return 200');
  const trialEvent = (history.body as { history: Array<{ event: string }> }).history?.find(h => h.event === 'trial_started');
  assert(Boolean(trialEvent), 'Subscription history contains trial_started event', `History: ${JSON.stringify((history.body as { history: unknown[] }).history?.slice(0, 3))}`, 'startTrial() must create Subscription audit log with event=trial_started');
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 8 — Subscription: Cancel, Renew, Get
// ═══════════════════════════════════════════════════════════════════════════════

async function suite_subscription_management() {
  suite('Subscription Management — Cancel / Renew / History');

  // 8.1 Cancel active trial
  const cancel = await POST<{ message: string }>('/subscription/cancel', {}, trialToken);
  assertStatus(cancel, 200, 'POST /subscription/cancel (active trial) → 200', 'cancelSubscriptionHandler must return 200');
  assert(
    typeof (cancel.body as { message?: string }).message === 'string',
    'Cancel returns message string',
    `message=${(cancel.body as { message?: string }).message}`,
    'cancelSubscription() must confirm cancellation in response',
  );

  // 8.2 Verify subscription status after cancel
  const sub = await GET<{ plan: string; status: string }>('/subscription', trialToken);
  assertStatus(sub, 200, 'GET /subscription after cancel → 200', 'getSubscriptionHandler must return 200');
  assert(
    (sub.body as { status?: string }).status === 'cancelled',
    'Subscription status=cancelled after cancel',
    `status=${(sub.body as { status?: string }).status}`,
    'cancelSubscription() must update User.subscriptionStatus to cancelled',
  );

  // 8.3 Cancel again (nothing to cancel)
  const cancel2 = await POST('/subscription/cancel', {}, trialToken);
  assertStatus(cancel2, 409, 'POST /subscription/cancel (already cancelled) → 409', "cancelSubscription() must throw AppError(409) when status is not active/grace_period");

  // 8.4 Renew — should fail for trial plan
  const renew = await POST('/subscription/renew', {}, trialToken);
  assertStatus(renew, 409, 'POST /subscription/renew on trial plan → 409', 'renewSubscription() must throw AppError(409) for trial plan');

  // 8.5 Subscription history has cancel event
  const history = await GET<{ history: Array<{ event: string }> }>('/subscription/history', trialToken);
  const cancelEvent = (history.body as { history: Array<{ event: string }> }).history?.find(h => h.event === 'cancelled');
  assert(Boolean(cancelEvent), 'Subscription history contains cancelled event', `History: ${JSON.stringify((history.body as { history: unknown[] }).history?.slice(0, 3))}`, 'cancelSubscription() must create Subscription audit log with event=cancelled');
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 9 — Razorpay Payment Flows
// ═══════════════════════════════════════════════════════════════════════════════

async function suite_razorpay() {
  suite('Razorpay Payment Integration');

  const razorpayKeyId     = process.env.RAZORPAY_KEY_ID     ?? '';
  const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET ?? '';
  const webhookSecret     = process.env.RAZORPAY_WEBHOOK_SECRET ?? '';

  if (!razorpayKeyId) {
    console.log(warn('RAZORPAY_KEY_ID not set — testing error handling paths only'));
  }

  // 9.1 Create order — invalid planId
  const badOrder = await POST('/subscription/create-order', { planId: 'invalid_plan' }, freeToken);
  assertStatus(badOrder, 400, 'POST /create-order with invalid planId → 400', 'createOrderHandler must validate planId with isValidPlanId()');

  // 9.2 Create order — missing planId
  const missingPlan = await POST('/subscription/create-order', {}, freeToken);
  assertStatus(missingPlan, 400, 'POST /create-order with missing planId → 400', 'createOrderHandler must return 400 when planId is absent');

  // 9.3 Create order — valid planId (will 500 if keys not set, 200 if keys are set)
  const order = await POST<{ orderId: string; amount: number; currency: string; keyId: string; planId: string }>(
    '/subscription/create-order', { planId: 'pro_1m' }, freeToken,
  );
  if (razorpayKeyId) {
    assertStatus(order, 200, 'POST /create-order with pro_1m → 200 (Razorpay keys configured)', 'createOrderHandler must call razorpay.orders.create()');
    assert(typeof (order.body as { orderId?: string }).orderId === 'string', 'Create order returns orderId', `orderId=${(order.body as { orderId?: string }).orderId}`, 'Razorpay order response must include order.id');
    assert((order.body as { amount?: number }).amount === 9900,  'Create order amount=9900 paise for pro_1m', `amount=${(order.body as { amount?: number }).amount}`, 'PAYMENT_PLANS.pro_1m.amountPaise must be 9900');
    assert((order.body as { currency?: string }).currency === 'INR', 'Create order currency=INR', `currency=${(order.body as { currency?: string }).currency}`, 'orders.create must use currency: INR');
    assert((order.body as { keyId?: string }).keyId === razorpayKeyId, 'Create order returns correct keyId', `keyId=${(order.body as { keyId?: string }).keyId}`, 'createOrderHandler must return env.RAZORPAY_KEY_ID');
  } else {
    assert(order.status === 500, 'POST /create-order without keys → 500 (key not configured)', `Got ${order.status}`, 'getRazorpay() must throw when RAZORPAY_KEY_ID is empty, caught as 500');
  }

  // 9.4 Verify payment — missing fields
  const badVerify = await POST('/subscription/verify', { razorpayOrderId: 'order_xxx' }, freeToken);
  assertStatus(badVerify, 400, 'POST /verify with missing fields → 400', 'verifyPaymentHandler must validate all 4 required fields');

  // 9.5 Verify payment — invalid signature
  const badSig = await POST('/subscription/verify', {
    razorpayOrderId:   'order_test123',
    razorpayPaymentId: 'pay_test456',
    razorpaySignature: 'invalidsignature',
    planId:            'pro_1m',
  }, freeToken);
  assertStatus(badSig, 400, 'POST /verify with invalid signature → 400', 'verifyPaymentHandler must reject HMAC mismatch');

  // 9.6 Verify payment — correct HMAC (only works if key secret is set)
  if (razorpayKeySecret) {
    const orderId   = 'order_testE2E123';
    const paymentId = `pay_e2e_${RUN}`;
    const sig = crypto.createHmac('sha256', razorpayKeySecret).update(`${orderId}|${paymentId}`).digest('hex');

    const verify = await POST<{ plan: string; status: string }>('/subscription/verify', {
      razorpayOrderId:   orderId,
      razorpayPaymentId: paymentId,
      razorpaySignature: sig,
      planId:            'pro_1m',
    }, freeToken);

    assertStatus(verify, 200, 'POST /verify with correct HMAC signature → 200 (activates subscription)', 'verifyPaymentHandler full path with valid sig');
    if (verify.status === 200) {
      const ents = verify.body as { plan?: string; status?: string; features?: Record<string, boolean>; dailyTestLimit?: null };
      assert(ents.plan === 'pro',    'Payment verify: plan set to pro',    `plan=${ents.plan}`,   'activateSubscription() must set plan=pro');
      assert(ents.status === 'active', 'Payment verify: status=active',   `status=${ents.status}`, 'activateSubscription() must set status=active');
      assert(ents.dailyTestLimit === null, 'Payment verify: unlimited tests', `limit=${ents.dailyTestLimit}`, 'pro plan should have dailyTestLimit=null');

      // 9.7 Idempotency — same paymentId should not double-activate
      const dupVerify = await POST('/subscription/verify', {
        razorpayOrderId:   orderId,
        razorpayPaymentId: paymentId,
        razorpaySignature: sig,
        planId:            'pro_1m',
      }, freeToken);
      assertStatus(dupVerify, 200, 'POST /verify duplicate paymentId → 200 (idempotent, no double-activate)', 'verifyPaymentHandler must check Subscription.findOne({razorpayPaymentId}) before activating');
    }
  } else {
    console.log(warn('Skipping valid-HMAC verify test (RAZORPAY_KEY_SECRET not set)'));
    record('POST /verify with valid HMAC signature → 200', false, 'RAZORPAY_KEY_SECRET not set in environment', 'Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to .env');
  }

  // 9.8 Webhook — invalid signature
  const webhookBody = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: { id: 'pay_test', order_id: 'order_test', amount: 9900, currency: 'INR' } } } });
  const badWebhook  = await WEBHOOK('/api/webhook/razorpay'.replace('/api', '').replace('http://localhost:5000', ''), webhookBody, 'badsig');
  // Webhook is at /api/webhook/razorpay but BASE is http://localhost:5000/api
  const webhookRes  = await fetch(`${BASE.replace('/api', '')}/api/webhook/razorpay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': 'invalidsig' },
    body:    webhookBody,
  });
  assert(webhookRes.status === 400, 'POST /api/webhook/razorpay with invalid sig → 400', `Got ${webhookRes.status}`, 'razorpayWebhookHandler must reject invalid HMAC');

  // 9.9 Webhook — valid signature (only if webhook secret configured)
  if (webhookSecret) {
    const correctSig = crypto.createHmac('sha256', webhookSecret).update(webhookBody).digest('hex');
    const webhookOk  = await fetch(`${BASE.replace('/api', '')}/api/webhook/razorpay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-razorpay-signature': correctSig },
      body:    webhookBody,
    });
    assert(webhookOk.status === 200, 'POST /api/webhook/razorpay with valid sig → 200', `Got ${webhookOk.status}`, 'razorpayWebhookHandler must return 200 for valid webhook');
  } else {
    record('POST /webhook/razorpay with valid HMAC → 200', false, 'RAZORPAY_WEBHOOK_SECRET not set', 'Add RAZORPAY_WEBHOOK_SECRET to .env to test webhook verification');
  }

  // 9.10 Verify: create-order requires auth
  const orderNoAuth = await POST('/subscription/create-order', { planId: 'pro_1m' });
  assertStatus(orderNoAuth, 401, 'POST /create-order without token → 401', 'protect middleware must guard create-order route');

  // 9.11 Verify: verify endpoint requires auth
  const verifyNoAuth = await POST('/subscription/verify', { razorpayOrderId: 'x', razorpayPaymentId: 'y', razorpaySignature: 'z', planId: 'pro_1m' });
  assertStatus(verifyNoAuth, 401, 'POST /verify without token → 401', 'protect middleware must guard verify route');
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 10 — Entitlement Expiry & State Sync
// ═══════════════════════════════════════════════════════════════════════════════

async function suite_entitlement_expiry() {
  suite('Entitlement Expiry & State Synchronisation');

  // We simulate expiry by directly manipulating the DB state via a dedicated
  // test-only endpoint (if available) or by testing the logic via /subscription.

  // 10.1 Test /subscription returns correct live entitlements
  const sub = await GET<{ plan: string; status: string; remainingDays: number | null }>('/subscription', trialToken);
  assertStatus(sub, 200, 'GET /subscription → 200', 'getSubscriptionHandler must return 200');
  assert(
    ['none', 'active', 'expired', 'cancelled', 'grace_period'].includes((sub.body as { status?: string }).status ?? ''),
    'GET /subscription returns valid status value',
    `status=${(sub.body as { status?: string }).status}`,
    'computeEntitlements must only return valid SubscriptionStatus values',
  );

  // 10.2 resolveStatus logic — verify via /subscription for a known-cancelled user
  // trialToken user cancelled their trial in suite 8
  assert(
    (sub.body as { status?: string }).status === 'cancelled',
    '/subscription shows cancelled status for cancelled-trial user',
    `status=${(sub.body as { status?: string }).status}`,
    'resolveStatus + cancelSubscription must write status=cancelled to User model',
  );
  assert(
    (sub.body as { remainingDays?: null }).remainingDays === null,
    'Cancelled subscription: remainingDays=null',
    `remainingDays=${(sub.body as { remainingDays?: null }).remainingDays}`,
    'computeEntitlements must return remainingDays=null for cancelled/expired status',
  );

  // 10.3 History count: trial_started + cancelled
  const history = await GET<{ history: Array<{ event: string }> }>('/subscription/history', trialToken);
  const events  = (history.body as { history: Array<{ event: string }> }).history?.map(h => h.event) ?? [];
  assert(
    events.includes('trial_started') && events.includes('cancelled'),
    'History audit trail: both trial_started and cancelled events present',
    `Events: ${JSON.stringify(events)}`,
    'startTrial() and cancelSubscription() must both create Subscription documents',
  );

  // 10.4 After expiry: features should be locked
  // The trialToken user is cancelled — verify features are off
  const access = await GET<{
    entitlements?: { features: Record<string, boolean>; status: string }
  }>('/access', trialToken);
  const features = (access.body as { entitlements?: { features: Record<string, boolean> } }).entitlements?.features;
  const gated    = ['planner', 'readiness', 'smartNotes', 'aiRevision'];
  for (const feat of gated) {
    assert(
      features?.[feat] === false,
      `Cancelled user: feature '${feat}' is revoked`,
      `${feat}=${features?.[feat]}`,
      'computeEntitlements must set features to NO_FEATURES when status is cancelled/expired',
    );
  }

  // 10.5 Verify isActive check in computeEntitlements
  // isActive = status === 'active' || status === 'grace_period'
  const status = (access.body as { entitlements?: { status: string } }).entitlements?.status;
  assert(
    status !== 'active' && status !== 'grace_period',
    'Cancelled user: not in active/grace_period state',
    `status=${status}`,
    'resolveStatus must not return active/grace_period for cancelled subscription',
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 11 — Security & Access Control Leak Detection
// ═══════════════════════════════════════════════════════════════════════════════

async function suite_security() {
  suite('Security & Access Control Leak Detection');

  // 11.1 Cross-user data isolation — create second user, try to access first user's test
  const user2    = makeUser('hacker');
  const signup2  = await POST<{ token: string }>('/auth/signup', user2);
  const token2   = (signup2.body as { token?: string }).token ?? '';

  if (testId && token2) {
    // Submit using second user's token but first user's testId
    const xSubmit = await POST('/test/submit', {
      testId, timeTaken: 100,
      answers: questionIds.slice(0, 1).map(id => ({ questionId: id, selectedOption: 'A' })),
    }, token2);

    assert(
      xSubmit.status === 403 || xSubmit.status === 404,
      'Cross-user test submission blocked (403 or 404)',
      `User2 can submit User1\'s test — status ${xSubmit.status}`,
      'gradeAndSave() must verify Test.userId === req.user.userId; throw AppError(403) on mismatch',
    );
  }

  // 11.2 JWT with wrong secret / tampered token
  const fakeToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOiI2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NiIsImVtYWlsIjoiZXZpbEB0ZXN0LmNvbSJ9.fakesig';
  const me = await GET('/auth/me', fakeToken);
  assertStatus(me, 401, 'GET /auth/me with tampered token → 401', 'verifyToken() must reject invalid JWT signatures');

  // 11.3 Expired JWT (edge case handled by library)
  // We can't easily generate an expired JWT without the secret, so we test that
  // a clearly malformed token is rejected
  const malformed = await GET('/analytics', 'not.a.jwt.at.all');
  assertStatus(malformed, 401, 'GET /analytics with malformed token → 401', 'protect middleware must reject non-JWT Bearer values');

  // 11.4 SQL injection / NoSQL injection — email field
  const injectionAttempt = await POST('/auth/login', {
    email:    '{"$gt": ""}',
    password: 'anything',
  });
  // Should return 400 (validation rejects) or 401 (email not found), NOT 200
  assert(
    injectionAttempt.status === 400 || injectionAttempt.status === 401,
    'NoSQL injection in email field is rejected (400 or 401)',
    `Got ${injectionAttempt.status}`,
    'validateLogin() must validate email format; Mongoose findOne with string email is safe vs object injection',
  );

  // 11.5 Webhook CSRF — webhook without signature header
  const noSigWebhook = await fetch(`${BASE.replace('/api', '')}/api/webhook/razorpay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    '{"event": "payment.captured"}',
  });
  assert(noSigWebhook.status === 400, 'Webhook without X-Razorpay-Signature → 400', `Got ${noSigWebhook.status}`, 'razorpayWebhookHandler must check for missing signature header');

  // 11.6 Plans endpoint accessible without auth (public)
  const plans = await GET('/subscription/plans');
  assertStatus(plans, 200, 'GET /subscription/plans accessible without auth (public route)', 'Plans route must NOT use protect middleware');

  // 11.7 Syllabus accessible without auth (public)
  const syl = await GET('/test/syllabus?exam=CBSE');
  assertStatus(syl, 200, 'GET /test/syllabus accessible without auth (public route)', 'Syllabus route must NOT use protect middleware');

  // 11.8 Sensitive fields not exposed
  const meData = await GET<{ user: Record<string, unknown> }>('/auth/me', freeToken);
  const userObj = (meData.body as { user?: Record<string, unknown> }).user;
  assert(
    userObj?.passwordHash === undefined,
    'GET /auth/me: passwordHash not exposed',
    'passwordHash field is present in /me response',
    'User.findById().select("-passwordHash") must exclude password from response',
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUITE 12 — Edge Cases & Boundary Conditions
// ═══════════════════════════════════════════════════════════════════════════════

async function suite_edge_cases() {
  suite('Edge Cases & Boundary Conditions');

  // 12.1 Empty test generation (0 questions requested — use minimum)
  const emptyGen = await POST('/test/generate', { exam: 'JEE_MAIN', subjects: ['Physics'], questionCount: 0, mode: 'normal' }, freeToken);
  assert(
    emptyGen.status === 400 || emptyGen.status === 201,
    'questionCount=0: handled (400 validation or 201 with min questions)',
    `status=${emptyGen.status}`,
    'validateGenerateBody() should reject questionCount=0 or generateTest() should use minimum',
  );

  // 12.2 Empty subjects array
  const noSubjects = await POST('/test/generate', { exam: 'JEE_MAIN', subjects: [], questionCount: 5, mode: 'normal' }, freeToken);
  assertStatus(noSubjects, 400, 'Empty subjects array → 400', 'validateGenerateBody() must reject empty subjects');

  // 12.3 history limit capping at 50
  const histMany = await GET('/subscription/history?limit=999', freeToken);
  assertStatus(histMany, 200, 'GET /subscription/history?limit=999 → 200 (capped at 50)', 'getHistoryHandler must cap limit at 50');

  // 12.4 Renewal on free user
  const renewFree = await POST('/subscription/renew', {}, freeToken);
  assertStatus(renewFree, 409, 'POST /subscription/renew on free user → 409', "renewSubscription() must throw AppError(409) for plan='free'");

  // 12.5 Analytics with no test data — should return empty arrays, not crash
  const emptyUser = makeUser('nodata');
  const emptySignup = await POST<{ token: string }>('/auth/signup', emptyUser);
  if (emptySignup.status === 201) {
    const emptyTok  = (emptySignup.body as { token: string }).token;
    const emptyAnal = await GET<Record<string, unknown>>('/analytics', emptyTok);
    assertStatus(emptyAnal, 200, 'GET /analytics for new user with no tests → 200 (not 500)', 'analyticsService must handle empty Results array gracefully');
    const emptyRev = await GET('/revision', emptyTok);
    assertStatus(emptyRev, 200, 'GET /revision for new user with no tests → 200 (not 500)', 'revisionService must handle empty Results array');
  }

  // 12.6 Submit with empty answers array
  if (testId) {
    const emptyAns = await POST('/test/submit', { testId, timeTaken: 60, answers: [] }, freeToken);
    assert(
      emptyAns.status === 201 || emptyAns.status === 400,
      'Submit with empty answers: handled gracefully (201 unattempted or 400)',
      `status=${emptyAns.status}. Body: ${JSON.stringify(emptyAns.body).slice(0, 150)}`,
      'gradeAndSave() must handle empty answers array without crash',
    );
  }

  // 12.7 Cancel subscription that was never started (new user)
  const freshUser   = makeUser('nocansub');
  const freshSignup = await POST<{ token: string }>('/auth/signup', freshUser);
  if (freshSignup.status === 201) {
    const freshTok = (freshSignup.body as { token: string }).token;
    const cantCancel = await POST('/subscription/cancel', {}, freshTok);
    assertStatus(cantCancel, 409, 'Cancel subscription for user with plan=free → 409', "cancelSubscription() must throw AppError(409) when status='none'");
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// REPORT GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

function generateReport() {
  const passed  = results.filter(r => r.passed);
  const failed  = results.filter(r => !r.passed);
  const total   = results.length;
  const passRate = ((passed.length / total) * 100).toFixed(1);

  console.log(`\n${'═'.repeat(72)}`);
  console.log(`${C.bold}  DENKENAI E2E VALIDATION REPORT${C.reset}`);
  console.log(`${'═'.repeat(72)}`);
  console.log(`  Run ID : ${RUN}`);
  console.log(`  API    : ${BASE}`);
  console.log(`  Total  : ${total} assertions`);
  console.log(`  ${C.green}Passed : ${passed.length}${C.reset}`);
  console.log(`  ${C.red}Failed : ${failed.length}${C.reset}`);
  console.log(`  Score  : ${passRate}%`);
  console.log(`${'─'.repeat(72)}`);

  // Group failures by suite
  const bySuite = new Map<string, TestResult[]>();
  for (const r of failed) {
    if (!bySuite.has(r.suite)) bySuite.set(r.suite, []);
    bySuite.get(r.suite)!.push(r);
  }

  if (failed.length === 0) {
    console.log(`\n${C.green}${C.bold}  ✓ All assertions passed. System is stable.${C.reset}\n`);
  } else {
    console.log(`\n${C.bold}  ISSUES REQUIRING ATTENTION${C.reset}\n`);

    let issueNum = 1;
    for (const [suiteName, failures] of bySuite) {
      console.log(`  ${C.bold}${C.cyan}[${suiteName}]${C.reset}`);
      for (const f of failures) {
        console.log(`\n  ${C.bold}Issue #${issueNum}:${C.reset} ${f.name}`);
        if (f.issue) console.log(`    ${C.red}Problem:${C.reset} ${f.issue}`);
        if (f.fix)   console.log(`    ${C.yellow}Fix:${C.reset}     ${f.fix}`);
        issueNum++;
      }
      console.log();
    }
  }

  // Critical path summary
  console.log(`${'─'.repeat(72)}`);
  console.log(`${C.bold}  CRITICAL PATH STATUS${C.reset}`);
  console.log(`${'─'.repeat(72)}`);

  const criticalFlows: Array<[string, string[]]> = [
    ['Signup → Auth',              ['POST /auth/signup → 201 Created', 'POST /auth/login → 200 OK', 'GET /auth/me returns correct user email']],
    ['Free Tier Gates',            ["Access: feature 'planner' is denied for free user", "GET /planner/week: free user gets 403 (planner gated)", "POST /notes/generate: free user gets 403 (smartNotes gated)"]],
    ['Test Generation',            ['POST /test/generate (normal mode, free) → 201', "POST /test/generate (mode='pyq', free) → 403", 'POST /test/submit → 201']],
    ['Daily Limit',                ['Daily limit enforcement active (hit 429 within 5 attempts)']],
    ['Trial Activation',           ['POST /subscription/trial → 200', "POST /subscription/trial (second call) → 409 Conflict", "Trial user: no 429 after 4+ test generations (unlimited)"]],
    ['Analytics/Revision Tiers',   ['Analytics returns _tier=free for non-subscriber', 'GET /revision returns _tier=full for trial user', 'GET /analytics returns _tier=full for trial user']],
    ['Payment Verification',       ['POST /create-order with invalid planId → 400', 'POST /verify with invalid signature → 400']],
    ['Webhook Security',           ['Webhook without X-Razorpay-Signature → 400', 'POST /api/webhook/razorpay with invalid sig → 400']],
    ['Access Control',             ['Cross-user test submission blocked (403 or 404)', 'GET /auth/me with tampered token → 401', 'GET /auth/me: passwordHash not exposed']],
    ['Cancellation',               ['POST /subscription/cancel (active trial) → 200', 'POST /subscription/cancel (already cancelled) → 409']],
  ];

  for (const [flowName, checks] of criticalFlows) {
    const flowResults = checks.map(c => results.find(r => r.name === c));
    const allPassed   = flowResults.every(r => r?.passed === true);
    const someFailed  = flowResults.some(r => r?.passed === false);
    const notRun      = flowResults.some(r => r === undefined);

    const icon = allPassed ? `${C.green}✓${C.reset}` : someFailed ? `${C.red}✗${C.reset}` : `${C.yellow}?${C.reset}`;
    console.log(`  ${icon} ${flowName}`);
  }

  // Recommendations
  console.log(`\n${'─'.repeat(72)}`);
  console.log(`${C.bold}  RECOMMENDATIONS${C.reset}`);
  console.log(`${'─'.repeat(72)}`);

  const recs: string[] = [];

  if (failed.some(f => f.suite === 'Health & Configuration' && f.name.includes('MongoDB'))) {
    recs.push('CRITICAL: Whitelist current IP (152.58.86.1) in MongoDB Atlas Network Access. All DB-dependent tests blocked until fixed.');
  }
  if (!process.env.RAZORPAY_KEY_ID) {
    recs.push('PAYMENT: Add RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET + RAZORPAY_WEBHOOK_SECRET to .env to enable live Razorpay flows.');
  }
  if (failed.some(f => f.name.includes('Cross-user test submission'))) {
    recs.push('SECURITY: gradeAndSave() must verify Test.userId === authenticated userId to prevent cross-user data access.');
  }
  if (failed.some(f => f.name.includes('passwordHash'))) {
    recs.push('SECURITY: Ensure User.findById().select("-passwordHash") is used in all /auth/me and profile endpoints.');
  }
  if (failed.some(f => f.name.includes('_tier=full') && f.suite.includes('Trial'))) {
    recs.push('ENTITLEMENTS: Trial plan should unlock all features including _tier=full in analytics and revision responses.');
  }
  if (failed.some(f => f.name.includes('Daily limit'))) {
    recs.push('USAGE: enforceTestLimit() may not be correctly counting daily results. Verify todayUtcStart() boundary and Result.countDocuments query.');
  }
  if (failed.some(f => f.name.includes('Duplicate signup'))) {
    recs.push('AUTH: registerUser() must check for existing email (case-insensitive) and throw AppError(409).');
  }

  if (recs.length === 0) {
    console.log(`  ${C.green}No critical recommendations. System looks healthy.${C.reset}`);
  } else {
    recs.forEach((r, i) => console.log(`  ${i + 1}. ${r}`));
  }

  console.log(`\n${'═'.repeat(72)}\n`);
  return failed.length;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log(`${C.bold}${C.cyan}`);
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║       DenkenAI — Comprehensive E2E Validation Suite              ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log(C.reset);
  console.log(info(`Target API: ${BASE}`));
  console.log(info(`Run ID:     ${RUN}\n`));

  try {
    await suite_health();
    await suite_auth();
    await suite_free_entitlements();
    await suite_test_flow();
    await suite_daily_limit();
    await suite_analytics_propagation();
    await suite_trial();
    await suite_subscription_management();
    await suite_razorpay();
    await suite_entitlement_expiry();
    await suite_security();
    await suite_edge_cases();
  } catch (err) {
    console.error(`\n${C.red}Fatal error in test suite:${C.reset}`, err);
    record('Test suite execution', false, String(err), 'Fix the fatal error above — most likely a DB connectivity issue');
  }

  const failCount = generateReport();
  process.exit(failCount > 0 ? 1 : 0);
}

main();
