import { Router, type RequestHandler } from 'express';
import { protect } from '../middleware/auth';
import { attachEntitlements } from '../middleware/attachEntitlements';
import { requireFeature } from '../middleware/entitlement';
import { ocrExtractHandler } from '../controllers/ocrController';

const router = Router();

router.use(protect as RequestHandler);
router.use(attachEntitlements());
router.use(requireFeature('ocr'));

router.post('/extract', ocrExtractHandler as RequestHandler);

export default router;
