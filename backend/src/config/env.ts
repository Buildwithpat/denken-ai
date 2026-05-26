import dotenv from 'dotenv';
import path from 'path';

// Resolve relative to this file so it works regardless of process.cwd()
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

if (!process.env.JWT_SECRET) {
  throw new Error('[env] JWT_SECRET is not set. Add it to backend/.env and restart the server.');
}

export const env = {
  PORT:        parseInt(process.env.PORT ?? '5000', 10),
  MONGO_URI:   process.env.MONGO_URI ?? 'mongodb://localhost:27017/denken-ai',
  AI_SERVICE_URL: process.env.AI_SERVICE_URL ?? 'http://localhost:8000',
  REDIS_URL:   process.env.REDIS_URL ?? '',           // optional; disables caching if absent
  NODE_ENV:    (process.env.NODE_ENV ?? 'development') as 'development' | 'production' | 'test',
  JWT_SECRET:  process.env.JWT_SECRET,
  RAZORPAY_KEY_ID:         process.env.RAZORPAY_KEY_ID         ?? '',
  RAZORPAY_KEY_SECRET:     process.env.RAZORPAY_KEY_SECRET     ?? '',
  RAZORPAY_WEBHOOK_SECRET: process.env.RAZORPAY_WEBHOOK_SECRET ?? '',
  // Direct Gemini API key — used by geminiQuestionGenerator for grounded question synthesis.
  GEMINI_API_KEY: process.env.GEMINI_API_KEY ?? '',
  // Explicit opt-in for dev-only API endpoints.
  DEV_MODE: process.env.DEV_MODE === 'true',
} as const;
