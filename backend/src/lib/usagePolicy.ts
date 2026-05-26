import type { TestMode } from '../types';

/** Modes that require an active subscription. */
export const PREMIUM_TEST_MODES: ReadonlySet<TestMode> = new Set(['pyq', 'mistake', 'smart']);

/** Free users may generate this many tests total (lifetime). */
export const FREE_TESTS_LIMIT = 1;

/** Free users may perform this many AI revisions total (lifetime). */
export const FREE_REVISIONS_LIMIT = 1;
