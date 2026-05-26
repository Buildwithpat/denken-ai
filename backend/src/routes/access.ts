import { Router, type RequestHandler } from 'express';
import { protect } from '../middleware/auth';
import { attachEntitlements } from '../middleware/attachEntitlements';
import { getAccessHandler } from '../controllers/accessController';

const router = Router();

router.use(protect as RequestHandler);
router.use(attachEntitlements());

router.get('/', getAccessHandler as RequestHandler);

export default router;
