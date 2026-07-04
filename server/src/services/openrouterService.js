import { openrouterClient } from '../utils/apiClient.js';
import logger from '../utils/logger.js';

// ── Model registry ─────────────────────────────────────────────────────────
/**
 * All models available for selection via POST /api/research { model }.
 * Add or remove entries here to expose new models to the frontend.
 */
export const AVAILABLE_MODELS = [
  {
    id:          'openai/gpt-4o-mini',
    label:       'GPT-4o Mini',
    provider:    'OpenAI',
    description: 'Fast, cost-efficient — good for most companies',
    default:     true,
  },
  {
    id:          'openai/gpt-4o',
    label:       'GPT-4o',
    provider:    'OpenAI',
    description: 'Most capable GPT model — deeper analysis',
    default:     false,
  },
  {
    id:          'anthropic/claude-3.5-sonnet',
    label:       'Claude 3.5 Sonnet',
    provider:    'Anthropic',
    description: 'Excellent at nuanced, long-form business writing',
    default:     false,
  },
  {
    id:          'anthropic/claude-3-haiku',
    label:       'Claude 3 Haiku',
    provider:    'Anthropic',
    description: 'Anthropic\'s fastest model — near-instant responses',
    default:     false,
  },
  {
    id:          'google/gemini-flash-1.5',
    label:       'Gemini Flash 1.5',
    provider:    'Google',
    description: 'Fast multimodal model from Google DeepMind',
    default:     false,
  },
  {
    id:          'meta-llama/llama-3.1-8b-instruct:free',
    label:       'Llama 3.1 8B (Free)',
    provider:    'Meta',
    description: 'Open-source model — no cost, good for testing',
    default:     false,
  },
];

export const DEFAULT_MODEL = AVAILABLE_MODELS.find((m) => m.default).id;

/**
 * Validate a model ID against the registry.
 * Falls back to DEFAULT_MODEL if the id is unrecognised.
 * @param {string} modelId
 * @returns {string}
 */
export const resolveModel = (modelId) => {
  const found = AVAILABLE_MODELS.find((m) => m.id === modelId);
  if (!found) {
    logger.warn(`[OpenRouterService] Unknown model "${modelId}" — falling back to ${DEFAULT_MODEL}`);
    return DEFAULT_MODEL;
  }
  return found.id;
};

// ── Prompt builder ─────────────────────────────────────────────────────────

/**
 * Assemble the full analysis prompt from Serper organic results and
 * crawled page content.  Both sources are clearly labelled so the model
 * can weight first-party (crawled) information appropriately.
 *
 * Limits:
 *  - Serper results: capped at 8 (avoids exceeding context window)
 *  - Crawled content: each page already truncated at 3 000 chars by the crawler
 *
 * @param {string} companyName
 * @param {Array}  sources       Organic results from Serper
 * @param {Array}  crawledPages  Pages returned by crawlerService
 * @returns {string}
 */
function buildPrompt(companyName, sources, crawledPages) {
  const sourcesText = sources
    .slice(0, 8)
    .map((s, i) => `[${i + 1}] ${s.title}\n${s.snippet}\nURL: ${s.link}`)
    .join('\n\n');

  const crawledText = crawledPages.length > 0
    ? crawledPages
        .map((p) => `--- ${p.title} (${p.path}) ---\n${p.text}`)
        .join('\n\n')
    : '';

  return `You are a senior business analyst and competitive intelligence researcher.

Analyse ALL the following information about "${companyName}" and produce a comprehensive, accurate research report.

## Web Search Results
${sourcesText || 'No search results available.'}
${crawledText ? `\n## Content Crawled Directly from the Company Website\n${crawledText}` : ''}

Respond ONLY with a single valid JSON object — no markdown fences, no explanation outside the JSON.
Use this exact schema:

{
  "summary": "3-4 paragraph executive summary: what the company does, its business model, market position, and trajectory",

  "productsServices": [
    { "name": "product or service name", "description": "one-sentence description of what it does and who it is for" }
  ],

  "painPoints": [
    "specific business pain point this company addresses for its customers OR a challenge the company itself faces"
  ],

  "competitors": [
    { "name": "competitor name", "description": "SPECIFIC product/service overlap (e.g. 'competes in smartwatch and fitness tracking') rather than a generic company description", "website": "competitor domain or null" }
  ],

  "keyPoints": [
    "concise key fact or highlight (metric, milestone, differentiator)"
  ],

  "industry": "precise industry / sector label",
  "founded": "founding year as a 4-digit string, or 'Unknown'",
  "headquarters": "City, Country (or State, Country for USA), or 'Unknown'",

  "recommendations": [
    "specific, actionable strategic recommendation for a business analyst evaluating this company"
  ],

  "swot": {
    "strengths": ["1-2 key internal strengths"],
    "weaknesses": ["1-2 key internal weaknesses"],
    "opportunities": ["1-2 key external opportunities"],
    "threats": ["1-2 key external threats"]
  }
}

Quantity requirements (do NOT produce fewer items than specified):
- productsServices: 3 – 6 items
- painPoints:       4 – 6 items  (mix of customer pain points solved AND company-level challenges)
- competitors:      3 – 5 items  (real, named competitors — no placeholders)
- keyPoints:        4 – 6 items
- recommendations:  3 – 4 items`;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * @typedef {Object} CompanyReport
 * @property {string}   summary
 * @property {Array}    productsServices   [{name, description}]
 * @property {Array}    painPoints         [string]
 * @property {Array}    competitors        [{name, description, website}]
 * @property {Array}    keyPoints          [string]
 * @property {string}   industry
 * @property {string}   founded
 * @property {string}   headquarters
 * @property {Array}    recommendations    [string]
 * @property {string}   _model             Resolved OpenRouter model ID
 */

/**
 * Generate a comprehensive company research report via OpenRouter.
 *
 * The OPENROUTER_API_KEY is read server-side from process.env inside
 * openrouterClient (utils/apiClient.js) — it is never sent to the browser.
 *
 * @param {string} companyName
 * @param {Array}  sources         Organic results from serperService
 * @param {Array}  [crawledPages]  Pages from crawlerService
 * @param {string} [model]         OpenRouter model ID (validated against registry)
 * @returns {Promise<CompanyReport>}
 */
export const generateCompanyReport = async (
  companyName,
  sources,
  crawledPages = [],
  model = DEFAULT_MODEL
) => {
  const resolvedModel = resolveModel(model);

  logger.info(
    `[OpenRouterService] Generating report for "${companyName}" ` +
    `| model: ${resolvedModel} ` +
    `| sources: ${sources.length} ` +
    `| crawled: ${crawledPages.length} pages`
  );

  const prompt = buildPrompt(companyName, sources, crawledPages);

  const response = await openrouterClient.post('/chat/completions', {
    model: resolvedModel,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.3,
    max_tokens: 2500,
  });

  const rawContent = response.data.choices?.[0]?.message?.content;
  if (!rawContent) throw new Error('OpenRouter returned an empty response');

  let parsed;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    throw new Error(`OpenRouter response was not valid JSON: ${rawContent.slice(0, 200)}`);
  }

  parsed.productsServices = Array.isArray(parsed.productsServices) ? parsed.productsServices : [];
  parsed.painPoints       = Array.isArray(parsed.painPoints)       ? parsed.painPoints       : [];
  parsed.competitors      = Array.isArray(parsed.competitors)      ? parsed.competitors      : [];
  parsed.keyPoints        = Array.isArray(parsed.keyPoints)        ? parsed.keyPoints        : [];
  parsed.recommendations  = Array.isArray(parsed.recommendations)  ? parsed.recommendations  : [];
  
  parsed.swot = parsed.swot || {};
  parsed.swot.strengths = Array.isArray(parsed.swot.strengths) ? parsed.swot.strengths : [];
  parsed.swot.weaknesses = Array.isArray(parsed.swot.weaknesses) ? parsed.swot.weaknesses : [];
  parsed.swot.opportunities = Array.isArray(parsed.swot.opportunities) ? parsed.swot.opportunities : [];
  parsed.swot.threats = Array.isArray(parsed.swot.threats) ? parsed.swot.threats : [];

  logger.info(
    `[OpenRouterService] Report done for "${companyName}" ` +
    `| ${parsed.productsServices.length} products | ` +
    `${parsed.painPoints.length} pain points | ` +
    `${parsed.competitors.length} competitors`
  );

  return { ...parsed, _model: resolvedModel };
};
