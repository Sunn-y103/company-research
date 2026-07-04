import express from 'express';
import * as aiController from '../controllers/aiController.js';

const router = express.Router();

router.post('/research', aiController.researchCompany);
router.post('/analyze', aiController.analyzeData);
router.post('/summarize', aiController.summarizeFindings);

export default router;