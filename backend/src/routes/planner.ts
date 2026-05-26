import { Router, type RequestHandler } from 'express';
import { protect } from '../middleware/auth';
import { attachEntitlements } from '../middleware/attachEntitlements';
import { weekPlanHandler, dayPlanHandler, plannerSummaryHandler } from '../controllers/plannerController';

const router = Router();

router.use(protect as RequestHandler);
router.use(attachEntitlements());

router.get('/week',    weekPlanHandler    as RequestHandler);
router.get('/day',     dayPlanHandler     as RequestHandler);
router.get('/summary', plannerSummaryHandler as RequestHandler);

export default router;
