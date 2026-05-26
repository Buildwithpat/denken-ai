import { Router, type RequestHandler } from 'express';
import { protect } from '../middleware/auth';
import { attachEntitlements } from '../middleware/attachEntitlements';
import { enforceRevisionLimit } from '../middleware/usageGuard';
import { getRevisionHandler } from '../controllers/revisionController';

const router = Router();

router.use(protect as RequestHandler);
router.use(attachEntitlements());

router.get('/', enforceRevisionLimit(), getRevisionHandler);

export default router;
