import { Router } from 'express';
import {
  getSubjectsHandler,
  getChaptersHandler,
  getChapterHandler,
  searchFormulasHandler,
} from '../controllers/formulaController';

const router = Router();

// Formula data is reference material — no authentication required.
router.get('/subjects',            getSubjectsHandler);
router.get('/chapters/:subject',   getChaptersHandler);
router.get('/chapter/:subject/:slug', getChapterHandler);
router.get('/search',              searchFormulasHandler);

export default router;
