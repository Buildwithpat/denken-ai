import { Router, type RequestHandler } from 'express';
import {
  getMistakePatternsHandler,
  getRevisionQueueHandler,
  getFormulaLinkedHandler,
  getTestMistakeAnalysisHandler,
} from '../controllers/mistakeController';
import { protect } from '../middleware/auth';
import { attachEntitlements } from '../middleware/attachEntitlements';

const router = Router();

router.use(protect as RequestHandler);
router.use(attachEntitlements());

router.get('/patterns',           getMistakePatternsHandler  as RequestHandler);
router.get('/revision-queue',     getRevisionQueueHandler    as RequestHandler);
router.get('/formula-linked',     getFormulaLinkedHandler    as RequestHandler);
router.get('/test/:resultId',     getTestMistakeAnalysisHandler as RequestHandler);

export default router;
