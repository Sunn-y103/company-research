import * as serperService from '../services/serperService.js';
import * as crawlerService from '../services/crawlerService.js';
import * as aiService from '../services/aiService.js';
import * as pdfService from '../services/pdfService.js';
import { AVAILABLE_MODELS, DEFAULT_MODEL } from '../services/openrouterService.js';
import logger from '../utils/logger.js';

// ── In-Memory Cache ────────────────────────────────────────────────────────
const reportCache = new Map();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

// ── GET /api/models ──────────────────────────────────────────────────────────────
/**
 * GET /api/models
 * Returns the registry of available OpenRouter models for the frontend selector.
 */
export const getModels = (_req, res) => {
  res.json({ models: AVAILABLE_MODELS, default: DEFAULT_MODEL });
};

// ── Mock data ──────────────────────────────────────────────────────────────
// Returned when MOCK_MODE=true in .env so development works without API quota.
// Mirrors the exact shape returned by the real path so the frontend is identical.
const buildMockReport = (companyName) => ({
  companyName,
  // ── Serper-extracted fields ──────────────────────────────────────────────
  officialWebsite: `https://www.${companyName.toLowerCase().replace(/\s+/g, '')}.com`,
  phone:           '+1 (800) 555-0100',
  address:         'San Francisco, CA, USA',
  description:
    `${companyName} is a globally recognised technology company. ` +
    `Its products and services span multiple industries worldwide.`,
  metadata: {
    Founded:  '2000',
    CEO:      'Jane Smith',
    Founders: 'John Doe, Jane Smith',
  },
  // ── AI-generated fields ──────────────────────────────────────────────────
  summary:
    `${companyName} is a globally recognised technology company known for its innovation across ` +
    `multiple sectors. With a strong market presence and a track record of disrupting traditional ` +
    `industries, the company continues to invest heavily in research and development. Its diversified ` +
    `product portfolio and strategic partnerships position it well for sustained long-term growth.`,
  industry: 'Technology',
  founded:  '2000',
  headquarters: 'San Francisco, CA, USA',
  keyPoints: [
    `${companyName} holds a leading market position in its core product segments.`,
    'Year-over-year revenue growth consistently outperforms industry averages.',
    'Strong brand loyalty with a global customer base spanning 150+ countries.',
    'Active M&A strategy — acquired 12 companies in the past 3 years.',
    'ESG commitments include carbon-neutral operations target by 2030.',
  ],
  recommendations: [
    'Monitor quarterly earnings closely — guidance revisions drive significant share-price moves.',
    'Assess competitive pressures from emerging market entrants before committing capital.',
    'Review supply-chain diversification plans given current geopolitical risks.',
  ],
  sources: [
    {
      title:   `${companyName} — Official Corporate Website`,
      link:    `https://www.${companyName.toLowerCase().replace(/\s+/g, '')}.com`,
      snippet: 'Official corporate information, investor relations, and press releases.',
      position: 1,
    },
    {
      title:   `${companyName} Company Profile — Reuters`,
      link:    `https://www.reuters.com/companies/${companyName.toLowerCase()}`,
      snippet: 'Financial data, news, and analyst ratings from Reuters.',
      position: 2,
    },
    {
      title:   `${companyName} Wikipedia`,
      link:    `https://en.wikipedia.org/wiki/${companyName.replace(/\s+/g, '_')}`,
      snippet: 'Encyclopaedic overview of company history, products, and operations.',
      position: 3,
    },
  ],
  // ── Crawler mock ─────────────────────────────────────────────────────────────
  crawledPages: [
    {
      path:       '/',
      url:        `https://www.${companyName.toLowerCase().replace(/\s+/g, '')}.com/`,
      title:      `${companyName} — Home`,
      text:       `Welcome to ${companyName}. We provide innovative solutions across multiple industries. Our mission is to deliver excellence in everything we do.`,
      statusCode: 200,
    },
    {
      path:       '/about',
      url:        `https://www.${companyName.toLowerCase().replace(/\s+/g, '')}.com/about`,
      title:      `About ${companyName}`,
      text:       `About us. Founded in 2000, ${companyName} has grown from a small startup to a global leader. We employ over 10,000 people across 30 countries.`,
      statusCode: 200,
    },
    {
      path:       '/products',
      url:        `https://www.${companyName.toLowerCase().replace(/\s+/g, '')}.com/products`,
      title:      `${companyName} Products`,
      text:       `Our products span enterprise software, cloud services, and hardware solutions. Trusted by over 5,000 businesses worldwide.`,
      statusCode: 200,
    },
  ],
  // ── AI-generated fields (new sections) ──────────────────────────────────
  productsServices: [
    { name: 'Core Platform',     description: `${companyName}'s primary SaaS product serving enterprise customers globally.` },
    { name: 'Analytics Suite',   description: 'Real-time data analytics and reporting dashboards.' },
    { name: 'API Integrations',  description: 'Developer APIs enabling third-party platform integrations.' },
    { name: 'Professional Services', description: 'Onboarding, training, and custom implementation services.' },
  ],
  painPoints: [
    'Customers struggle with manual, time-consuming processes that the platform automates.',
    'Integration complexity with legacy enterprise systems slows adoption.',
    'Increasing competition drives pressure on pricing and feature parity.',
    'Scaling support and customer success as the user base grows internationally.',
    'Maintaining data privacy compliance across multiple regulatory jurisdictions.',
  ],
  competitors: [
    { name: 'Competitor A', description: 'Direct competitor offering similar SaaS solutions to mid-market businesses.', website: null },
    { name: 'Competitor B', description: 'Established enterprise player with a broader but more expensive product suite.', website: null },
    { name: 'Competitor C', description: 'Fast-growing startup targeting the same buyer persona with a leaner product.', website: null },
  ],
  swot: {
    strengths: [
      'Strong brand recognition and global market presence.',
      'Highly diversified product portfolio generating stable cash flow.'
    ],
    weaknesses: [
      'Heavy reliance on a few key enterprise clients for 40% of revenue.',
      'Slower innovation cycle compared to agile startups.'
    ],
    opportunities: [
      'Expansion into emerging markets with localized offerings.',
      'Strategic M&A to acquire cutting-edge AI technologies.'
    ],
    threats: [
      'Increasing regulatory scrutiny over data privacy.',
      'Intense competition leading to price wars and margin compression.'
    ]
  },
  _model: DEFAULT_MODEL,
  mock:      true,
  timestamp: new Date().toISOString(),
});

/**
 * POST /api/research
 * Body: { query: string, model?: string }
 *
 * Response shape:
 * {
 *   companyName, officialWebsite, phone, address, description, metadata,
 *   summary, productsServices, painPoints, competitors,
 *   keyPoints, recommendations, industry, founded, headquarters,
 *   sources, crawledPages, _model, mock, timestamp
 * }
 *
 * MOCK_MODE=true  → rich mock instantly (no API calls)
 * MOCK_MODE=false → Serper → Crawler → OpenRouter (all keys server-side)
 */
export const research = async (req, res) => {
  try {
    const { query, model } = req.body;

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({ error: 'query is required and must be a non-empty string' });
    }

    const companyName  = query.trim();
    const isMock       = process.env.MOCK_MODE === 'true';
    const selectedModel = model || DEFAULT_MODEL;

    // Set headers for NDJSON streaming
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const emit = (status) => res.write(JSON.stringify({ status }) + '\n');

    logger.info(`[ResearchController] Research: "${companyName}" | model: ${selectedModel} | mock: ${isMock}`);

    // ── Cache check ────────────────────────────────────────────────────────
    if (!isMock) {
      const cacheKey = `${companyName.toLowerCase()}-${selectedModel}`;
      const cached = reportCache.get(cacheKey);
      if (cached && cached.expires > Date.now()) {
        emit('Found cached report, loading...');
        res.write(JSON.stringify({ result: cached.data }) + '\n');
        return res.end();
      }
    }

    // ── Mock path ──────────────────────────────────────────────────────────
    if (isMock) {
      emit('Initializing mock agent...');
      await new Promise((r) => setTimeout(r, 800));
      emit('Generating mock report...');
      res.write(JSON.stringify({ result: buildMockReport(companyName) }) + '\n');
      return res.end();
    }

    // ── Real path ──────────────────────────────────────────────────────────
    emit('Searching web via Serper.dev...');
    const serperData = await serperService.searchCompany(companyName);
    const { officialWebsite, phone, address, description, metadata, organic } = serperData;

    if (officialWebsite) {
      emit(`Crawling official website: ${officialWebsite}...`);
    } else {
      emit('No official website found, skipping crawl...');
    }
    const crawledPages = officialWebsite
      ? await crawlerService.crawlCompanyWebsite(officialWebsite)
      : [];

    emit('Synthesizing data with OpenRouter AI...');
    const aiReport = await aiService.summarizeResearch(companyName, organic, crawledPages, selectedModel);

    emit('Finalizing report...');
    const finalReport = {
      companyName,
      officialWebsite: officialWebsite ?? null,
      phone:           phone           ?? null,
      address:         address         ?? null,
      description:     description     ?? null,
      metadata:        metadata        ?? {},
      ...aiReport,
      sources:         organic,
      crawledPages:    crawledPages.map(({ path, url, title, statusCode }) => ({ path, url, title, statusCode })),
      mock:            false,
      timestamp:       new Date().toISOString(),
    };

    // Save to cache
    const cacheKey = `${companyName.toLowerCase()}-${selectedModel}`;
    reportCache.set(cacheKey, { data: finalReport, expires: Date.now() + CACHE_TTL });

    res.write(JSON.stringify({ result: finalReport }) + '\n');
    res.end();
  } catch (error) {
    logger.error('[ResearchController] Research failed', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'Research failed' });
    } else {
      res.write(JSON.stringify({ error: error.message || 'Research failed' }) + '\n');
      res.end();
    }
  }
};

/**
 * POST /api/pdf
 * Accepts the research data object and streams back a PDF report.
 * PDF is generated server-side with pdfkit — no PDF library needed on the client.
 */
export const generatePdf = (req, res) => {
  try {
    pdfService.generateReport(req.body, res);
  } catch (error) {
    logger.error('[ResearchController] PDF generation failed', error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || 'PDF generation failed' });
    }
  }
};
