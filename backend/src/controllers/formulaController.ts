import type { Request, Response, RequestHandler } from 'express';
import {
  getSubjects,
  getChapters,
  getChapter,
  searchFormulas,
} from '../lib/formulaLoader';

// ── GET /api/formula/subjects?exam= ──────────────────────────────────────────

export const getSubjectsHandler: RequestHandler = (_req: Request, res: Response): void => {
  const exam = typeof _req.query.exam === 'string' ? _req.query.exam : undefined;
  res.json({ subjects: getSubjects(exam) });
};

// ── GET /api/formula/chapters/:subject?exam= ─────────────────────────────────

export const getChaptersHandler: RequestHandler = (req: Request, res: Response): void => {
  const { subject } = req.params as { subject: string };
  const exam = typeof req.query.exam === 'string' ? req.query.exam : undefined;

  const chapters = getChapters(subject, exam);
  if (chapters.length === 0) {
    res.status(404).json({ error: `No formula chapters found for subject "${subject}"` });
    return;
  }

  res.json({ subject, chapters });
};

// ── GET /api/formula/chapter/:subject/:slug ───────────────────────────────────

export const getChapterHandler: RequestHandler = (req: Request, res: Response): void => {
  const { subject, slug } = req.params as { subject: string; slug: string };
  const chapter = getChapter(subject, slug);

  if (!chapter) {
    res.status(404).json({
      error: `Formula chapter "${slug}" not found in subject "${subject}"`,
    });
    return;
  }

  res.json(chapter);
};

// ── GET /api/formula/search?q=&subject=&exam=&limit= ─────────────────────────

export const searchFormulasHandler: RequestHandler = (req: Request, res: Response): void => {
  const q      = typeof req.query.q       === 'string' ? req.query.q.trim()       : '';
  const subject = typeof req.query.subject === 'string' ? req.query.subject        : undefined;
  const exam    = typeof req.query.exam    === 'string' ? req.query.exam           : undefined;
  const rawLimit = parseInt(String(req.query.limit ?? '20'), 10);
  const limit   = isNaN(rawLimit) || rawLimit < 1 ? 20 : Math.min(rawLimit, 100);

  if (!q) {
    res.status(400).json({ error: '`q` query parameter is required' });
    return;
  }

  const results = searchFormulas(q, { subject, exam, limit });
  res.json({ query: q, count: results.length, results });
};
