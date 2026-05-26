import { Router, type RequestHandler } from 'express';
import { protect } from '../middleware/auth';
import { attachEntitlements } from '../middleware/attachEntitlements';
import { readinessReportHandler } from '../controllers/readinessController';

const router = Router();

router.use(protect as RequestHandler);
router.use(attachEntitlements());

router.get('/', readinessReportHandler as RequestHandler);

export default router;
