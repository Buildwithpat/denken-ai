import { Router, type RequestHandler } from 'express';
import { protect } from '../middleware/auth';
import { attachEntitlements } from '../middleware/attachEntitlements';
import { getRoadmapHandler } from '../controllers/roadmapController';

const router = Router();

router.use(protect as RequestHandler);
router.use(attachEntitlements());

router.get('/', getRoadmapHandler);

export default router;
