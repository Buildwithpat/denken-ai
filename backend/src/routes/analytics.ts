import { Router, type RequestHandler } from 'express';
import { getAnalyticsHandler, trackEventHandler } from '../controllers/analyticsController';
import { protect } from '../middleware/auth';
import { attachEntitlements } from '../middleware/attachEntitlements';

const router = Router();

router.use(protect as RequestHandler);
router.use(attachEntitlements());

router.get('/',      getAnalyticsHandler as RequestHandler);
router.post('/event', trackEventHandler  as RequestHandler);

export default router;
