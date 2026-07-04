/**
 * aiService.js — Thin orchestration layer.
 *
 * The heavy OpenRouter logic (model registry, prompt building, JSON parsing)
 * now lives in openrouterService.js.  This module delegates to it and keeps
 * the backward-compatible exports that aiController.js and aiRoutes.js use.
 */
import { openrouterClient } from '../utils/apiClient.js';
import { generateCompanyReport, DEFAULT_MODEL } from './openrouterService.js';
import logger from '../utils/logger.js';

// ── Primary export (called by researchController) ──────────────────────────

/**
 * Backward-compatible wrapper around openrouterService.generateCompanyReport.
 * Kept so existing callers don't need to change their import paths.
 *
 * @param {string} companyName
 * @param {Array}  sources       Organic results from Serper
 * @param {Array}  [crawledPages=[]]
 * @param {string} [model]
 * @returns {Promise<CompanyReport>}
 */
export const summarizeResearch = (companyName, sources, crawledPages = [], model = DEFAULT_MODEL) =>
  generateCompanyReport(companyName, sources, crawledPages, model);

// ── Legacy exports (used by aiController / aiRoutes) ──────────────────────

/**
 * Analyze arbitrary data using OpenRouter.
 * @param {*} data
 */
export const analyzeData = async (data) => {
  const response = await openrouterClient.post('/chat/completions', {
    model: DEFAULT_MODEL,
    messages: [
      {
        role: 'user',
        content: `Analyze the following data and return JSON with keys: analysis, insights (array), confidence (0-1).\n\n${JSON.stringify(data)}`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });

  const content = response.data.choices?.[0]?.message?.content;
  return content ? JSON.parse(content) : { analysis: {}, insights: [], confidence: 0 };
};

/**
 * Summarize findings using OpenRouter.
 * @param {*} findings
 */
export const summarizeFindings = async (findings) => {
  const response = await openrouterClient.post('/chat/completions', {
    model: DEFAULT_MODEL,
    messages: [
      {
        role: 'user',
        content: `Summarize the following findings. Return JSON with keys: summary (string), keyPoints (array), recommendations (array).\n\n${JSON.stringify(findings)}`,
      },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });

  const content = response.data.choices?.[0]?.message?.content;
  return content ? JSON.parse(content) : { summary: '', keyPoints: [], recommendations: [] };
};

// Legacy stub — kept for backward compat with aiController
export const researchCompany = async (companyName) => ({
  companyName,
  researchData: {},
  sources: [],
  timestamp: new Date().toISOString(),
});