import { Router, type RequestHandler } from 'express';
import { protect }             from '../middleware/auth';
import { attachEntitlements }  from '../middleware/attachEntitlements';
import { aiQuotaGuard }           from '../middleware/aiQuota';
import { aiEndpointRateLimiter }  from '../middleware/rateLimiter';
import {
  mentorChatHandler,
  mentorSessionHandler,
  ingestFormulasHandler,
} from '../controllers/mentorController';

const router = Router();

router.use(protect as RequestHandler);
router.use(attachEntitlements());

router.post('/chat', aiEndpointRateLimiter as RequestHandler, aiQuotaGuard('/mentor/chat') as RequestHandler, mentorChatHandler);
router.get('/session',           mentorSessionHandler);
router.post('/ingest-formulas',  ingestFormulasHandler);

export default router;
