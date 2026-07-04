import express from 'express';
import * as researchController from '../controllers/researchController.js';

const router = express.Router();

/**
 * GET /api/models
 * Returns the list of available OpenRouter models for the frontend selector.
 */
router.get('/models', researchController.getModels);

/**
 * POST /api/research
 * Body: { query: string, model?: string }
 * Returns: structured research report (JSON)
 */
router.post('/research', researchController.research);

/**
 * POST /api/pdf
 * Body: research report object
 * Returns: PDF binary stream
 */
router.post('/pdf', researchController.generatePdf);

export default router;

