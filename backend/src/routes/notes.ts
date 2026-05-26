import { Router, type RequestHandler } from 'express';
import { protect } from '../middleware/auth';
import { attachEntitlements } from '../middleware/attachEntitlements';
import { requireFeature } from '../middleware/entitlement';
import { generateNotesHandler } from '../controllers/notesController';

const router = Router();

router.use(protect as RequestHandler);
router.use(attachEntitlements());
router.use(requireFeature('smartNotes'));

router.post('/generate', generateNotesHandler);

export default router;
