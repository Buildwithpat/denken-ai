import { Router, type RequestHandler } from 'express';
import { protect }             from '../middleware/auth';
import { attachEntitlements }  from '../middleware/attachEntitlements';
import { aiQuotaGuard }        from '../middleware/aiQuota';
import {
  startPracticeSessionHandler,
  submitPracticeAnswerHandler,
  getPracticeSessionSummaryHandler,
  getPracticeRecommendationsHandler,
} from '../controllers/adaptivePracticeController';

const router = Router();

// All adaptive practice routes require authentication
router.use(protect);
router.use(attachEntitlements());

/** Get personalised practice recommendations */
router.get('/recommendations', getPracticeRecommendationsHandler as RequestHandler);

/** Start a new focused practice session — AI-powered, quota-gated */
router.post(
  '/session',
  aiQuotaGuard('/adaptive/concept-guidance') as RequestHandler,
  startPracticeSessionHandler as RequestHandler,
);

/** Submit an answer for the current question in a session */
router.post('/session/:sessionId/answer', submitPracticeAnswerHandler as RequestHandler);

/** Get session summary (final results) */
router.get('/session/:sessionId/summary', getPracticeSessionSummaryHandler as RequestHandler);

export default router;
