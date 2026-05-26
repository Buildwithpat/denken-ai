import { Response } from 'express';
import type { RequestHandler } from 'express';
import { generateNotes } from '../services/notesService';
import { AppError } from '../utils/AppError';

const VALID_DEPTHS  = ['short', 'medium', 'detailed'] as const;
const VALID_MODES   = ['theory', 'formula', 'both']   as const;

type Depth = typeof VALID_DEPTHS[number];
type Mode  = typeof VALID_MODES[number];

export const generateNotesHandler: RequestHandler = async (req, res: Response): Promise<void> => {
  const { topic, subject, exam, depth, mode } = req.body as {
    topic?:   string;
    subject?: string;
    exam?:    string;
    depth?:   string;
    mode?:    string;
  };

  if (!topic?.trim() || !subject?.trim()) {
    res.status(400).json({ error: '`topic` and `subject` are required.' });
    return;
  }

  const safeDepth: Depth = VALID_DEPTHS.includes(depth as Depth) ? (depth as Depth) : 'medium';
  const safeMode:  Mode  = VALID_MODES.includes(mode as Mode)   ? (mode as Mode)   : 'both';

  try {
    const result = await generateNotes({
      topic:   topic.trim(),
      subject: subject.trim(),
      exam:    exam ?? 'JEE_MAIN',
      depth:   safeDepth,
      mode:    safeMode,
    });

    if (!result) {
      res.status(503).json({ error: 'AI service is currently unavailable. Please try again shortly.' });
      return;
    }

    res.status(200).json(result);
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Failed to generate notes.' });
  }
};
