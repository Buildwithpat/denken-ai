import {
  Router,
  type Request,
  type Response,
  type NextFunction,
  type RequestHandler,
} from "express";

import { protect } from "../middleware/auth";
import {
  listPersonasHandler,
  setPersonaHandler,
  groundedGenerateDebugHandler,
  groundedFullTestDebugHandler,
  importantTopicsDebugHandler,
  chapterIntelligenceDebugHandler,
  intelligentTestDebugHandler,
  bankGroundingDebugHandler,
  fullGroundingDebugHandler,
} from "../controllers/devController";

import { env } from "../config/env";

console.log("✅ DEV ROUTER FILE LOADED");

const router = Router();

// DEV MODE HARD GATE
router.use((req: Request, res: Response, next: NextFunction) => {
  console.log("DEV_MODE value:", env.DEV_MODE);

  if (!env.DEV_MODE) {
    console.log("❌ DEV MODE DISABLED");

    res.status(404).json({
      error: "Route not found",
    });

    return;
  }

  console.log("✅ DEV MODE ENABLED");

  next();
});

// AUTH PROTECTION
router.use(protect as RequestHandler);

// GET PERSONAS
router.get(
  "/personas",
  ((req: Request, res: Response, next: NextFunction) => {
    console.log("🔥 HIT /api/dev/personas");
    next();
  }) as RequestHandler,
  listPersonasHandler as RequestHandler,
);

// SET PERSONA
router.post(
  "/set-persona",
  ((req: Request, res: Response, next: NextFunction) => {
    console.log("🔥 HIT /api/dev/set-persona");
    console.log("BODY:", req.body);
    next();
  }) as RequestHandler,
  setPersonaHandler as RequestHandler,
);

// GROUNDED GENERATION DEBUG — generate questions for a single chapter/topic
// with full debug output showing which PYQs, formulas, and syllabus refs were injected.
router.post(
  "/grounded-generate",
  ((req: Request, res: Response, next: NextFunction) => {
    console.log("🔥 HIT /api/dev/grounded-generate", req.body);
    next();
  }) as RequestHandler,
  groundedGenerateDebugHandler as unknown as RequestHandler,
);

// GROUNDED FULL TEST — generate a complete mock test via the PYQ-grounded pipeline.
// Returns per-question source attribution (bank / gemini-grounded / template-fallback).
router.post(
  "/grounded-full-test",
  ((req: Request, res: Response, next: NextFunction) => {
    console.log("🔥 HIT /api/dev/grounded-full-test", req.body);
    next();
  }) as RequestHandler,
  groundedFullTestDebugHandler as unknown as RequestHandler,
);

// IMPORTANT TOPICS — inspect the strategic intelligence dataset.
// GET /api/dev/important-topics?exam=JEE_MAIN&subject=Physics&mode=high-roi&topN=10
router.get(
  "/important-topics",
  ((req: Request, res: Response, next: NextFunction) => {
    console.log("🔥 HIT /api/dev/important-topics", req.query);
    next();
  }) as RequestHandler,
  importantTopicsDebugHandler as RequestHandler,
);

// CHAPTER INTELLIGENCE — inspect the intelligence profile for a single chapter.
// POST /api/dev/chapter-intelligence  { exam, subject, chapter }
router.post(
  "/chapter-intelligence",
  ((req: Request, res: Response, next: NextFunction) => {
    console.log("🔥 HIT /api/dev/chapter-intelligence", req.body);
    next();
  }) as RequestHandler,
  chapterIntelligenceDebugHandler as RequestHandler,
);

// INTELLIGENT TEST — generate a mock test using important-topics adaptive modes.
// POST /api/dev/intelligent-test  { exam, subjects?, questionCount?, adaptiveMode }
router.post(
  "/intelligent-test",
  ((req: Request, res: Response, next: NextFunction) => {
    console.log("🔥 HIT /api/dev/intelligent-test", req.body);
    next();
  }) as RequestHandler,
  intelligentTestDebugHandler as unknown as RequestHandler,
);

// BANK GROUNDING — inspect question-bank examples for a chapter.
// POST /api/dev/bank-grounding  { exam, subject, chapter, limit? }
router.post(
  "/bank-grounding",
  ((req: Request, res: Response, next: NextFunction) => {
    console.log("🔥 HIT /api/dev/bank-grounding", req.body);
    next();
  }) as RequestHandler,
  bankGroundingDebugHandler as RequestHandler,
);

// FULL GROUNDING — inspect complete Gemini grounding context (bank + PYQ + formulas + intel).
// POST /api/dev/full-grounding  { exam, subject, chapter, topic? }
router.post(
  "/full-grounding",
  ((req: Request, res: Response, next: NextFunction) => {
    console.log("🔥 HIT /api/dev/full-grounding", req.body);
    next();
  }) as RequestHandler,
  fullGroundingDebugHandler as unknown as RequestHandler,
);

export default router;
