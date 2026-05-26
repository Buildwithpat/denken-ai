import { Router, type RequestHandler } from 'express';
import {
  generateTestHandler,
  submitTestHandler,
  getSyllabusHandler,
  getTestRecommendationHandler,
} from '../controllers/testController';
import { protect } from '../middleware/auth';
import { attachEntitlements } from '../middleware/attachEntitlements';
import { enforceTestLimit } from '../middleware/usageGuard';
import { aiEndpointRateLimiter } from '../middleware/rateLimiter';

const router = Router();

// Syllabus is public — no auth or entitlement check
router.get('/syllabus', getSyllabusHandler as RequestHandler);

// Protected routes share one entitlement fetch via attachEntitlements
router.use(protect as RequestHandler);
router.use(attachEntitlements());

router.get('/recommend', getTestRecommendationHandler as RequestHandler);
router.post('/generate', aiEndpointRateLimiter as RequestHandler, enforceTestLimit(), generateTestHandler as RequestHandler);
router.post('/submit',   submitTestHandler as RequestHandler);

export default router;
