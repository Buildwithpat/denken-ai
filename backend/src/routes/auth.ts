import { Router, RequestHandler } from 'express';
import { signup, login, logout, getMe, completeOnboardingHandler } from '../controllers/authController';
import { protect } from '../middleware/auth';
import { authRateLimiter } from '../middleware/rateLimiter';

const router = Router();

router.post('/signup', authRateLimiter, signup);
router.post('/login',  authRateLimiter, login);
router.post('/logout', protect as RequestHandler, logout);
router.get('/me', protect as RequestHandler, getMe as RequestHandler);
router.post('/complete-onboarding', protect as RequestHandler, completeOnboardingHandler as RequestHandler);

export default router;
