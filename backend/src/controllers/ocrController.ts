import { Response } from 'express';
import type { AuthRequest } from '../middleware/auth';

/**
 * POST /api/ocr/extract
 *
 * Stub — returns 501 until the OCR service is wired up.
 * The route is already gated by requireFeature('ocr') so only active
 * subscribers will reach this handler.
 */
export function ocrExtractHandler(_req: AuthRequest, res: Response): void {
  res.status(503).json({
    error: 'OCR extraction is coming soon. Your subscription includes this feature once it launches.',
    code:  'OCR_COMING_SOON',
  });
}
