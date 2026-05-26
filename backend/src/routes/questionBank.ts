import { Router, type RequestHandler } from 'express';
import { protect }            from '../middleware/auth';
import { attachEntitlements } from '../middleware/attachEntitlements';
import {
  getStatsHandler,
  getQuestionsHandler,
  getOneHandler,
  upsertHandler,
  deleteHandler,
  formulaLinkedHandler,
  conceptMapHandler,
  conceptInsightsHandler,
} from '../controllers/questionBankController';

const router = Router();

// Public read-only stats (no auth needed for admin dashboard probes)
router.get('/stats', getStatsHandler as RequestHandler);

// Authenticated routes
router.use(protect as RequestHandler);
router.use(attachEntitlements());

router.get('/questions',       getQuestionsHandler as RequestHandler);
router.get('/formula-linked',  formulaLinkedHandler as RequestHandler);
router.get('/concept-map',     conceptMapHandler as RequestHandler);
router.get('/concept-insights', conceptInsightsHandler as RequestHandler);
router.get('/:stableId',       getOneHandler as RequestHandler);
router.put('/:stableId',       upsertHandler as RequestHandler);
router.delete('/:stableId',    deleteHandler as RequestHandler);

export default router;
