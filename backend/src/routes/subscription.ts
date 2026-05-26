import { Router, type RequestHandler } from 'express';
import { protect } from '../middleware/auth';
import {
  getSubscriptionHandler,
  cancelSubscriptionHandler,
  renewSubscriptionHandler,
  getHistoryHandler,
  getPlansHandler,
  createOrderHandler,
  verifyPaymentHandler,
} from '../controllers/subscriptionController';

const router = Router();

// Public — no auth required
router.get('/plans', getPlansHandler as RequestHandler);

// Protected routes
router.use(protect as RequestHandler);

router.get('/',         getSubscriptionHandler    as RequestHandler);
router.get('/history',  getHistoryHandler          as RequestHandler);
router.post('/renew',   renewSubscriptionHandler   as RequestHandler);
router.post('/cancel',  cancelSubscriptionHandler  as RequestHandler);
router.post('/create-order', createOrderHandler    as RequestHandler);
router.post('/verify',       verifyPaymentHandler  as RequestHandler);

export default router;
