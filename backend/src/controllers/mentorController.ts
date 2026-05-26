import { Response, NextFunction, type RequestHandler } from 'express';
import type { AuthRequest }  from '../middleware/auth';
import {
  mentorChat,
  getSession,
  triggerFormulaIngestion,
} from '../services/mentorService';

// ── POST /api/mentor/chat ─────────────────────────────────────────────────────

export const mentorChatHandler: RequestHandler = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) { res.status(401).json({ error: 'Unauthorised' }); return; }

    const {
      message,
      chapter  = null,
      subject  = null,
      exam     = 'JEE_MAIN',
      intent   = null,
    } = req.body as {
      message: string;
      chapter?: string | null;
      subject?: string | null;
      exam?:    string;
      intent?:  string | null;
    };

    if (!message || typeof message !== 'string' || message.trim().length < 2) {
      res.status(400).json({ error: 'message is required (min 2 chars)' });
      return;
    }

    const response = await mentorChat(userId, message.trim(), chapter, subject, exam, intent);
    res.json(response);
  } catch (err) {
    next(err);
  }
};

// ── GET /api/mentor/session ───────────────────────────────────────────────────

export const mentorSessionHandler: RequestHandler = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const userId = req.user?.userId;
    if (!userId) { res.status(401).json({ error: 'Unauthorised' }); return; }

    const session = await getSession(userId);
    res.json(session);
  } catch (err) {
    next(err);
  }
};

// ── POST /api/mentor/ingest-formulas ─────────────────────────────────────────
// Admin-only endpoint to populate ChromaDB with formula embeddings.

export const ingestFormulasHandler: RequestHandler = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const {
      subject = 'Physics',
      exam    = 'JEE_MAIN',
      replace = false,
    } = req.body as { subject?: string; exam?: string; replace?: boolean };

    const result = await triggerFormulaIngestion(subject, exam, replace);
    res.json(result);
  } catch (err) {
    next(err);
  }
};
