import { Router, type RequestHandler } from 'express';
import { protect }            from '../middleware/auth';
import { attachEntitlements } from '../middleware/attachEntitlements';
import {
  getExplanationHandler,
  getHintsHandler,
} from '../controllers/explanationController';

const router = Router();

router.use(protect as RequestHandler);
router.use(attachEntitlements());

router.get('/:stableId/hints', getHintsHandler as RequestHandler);
router.get('/:stableId',       getExplanationHandler as RequestHandler);

export default router;
