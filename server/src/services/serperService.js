import { serperClient } from '../utils/apiClient.js';
import logger from '../utils/logger.js';

// ── Phone extraction ───────────────────────────────────────────────────────
// Keys that Serper's knowledge graph uses to carry a phone number.
const PHONE_ATTR_KEYS = [
  'Customer service',
  'Phone',
  'Phone number',
  'Telephone',
  'Contact',
  'Helpline',
  'Support',
];

// Loose regex: matches most international phone formats.
// Examples: +1 800 275-2273 | (800) 275-2273 | 1-800-275-2273
const PHONE_RE = /(\+?[\d][\d\s\-().]{6,18}\d)/g;

/**
 * Try to find a phone number from the knowledge graph attributes first,
 * then fall back to scanning the first few organic snippets.
 */
function extractPhone(attributes = {}, organic = []) {
  // 1. Knowledge graph attributes (most reliable)
  for (const key of PHONE_ATTR_KEYS) {
    if (attributes[key]) {
      const val = String(attributes[key]).trim();
      const match = val.match(PHONE_RE);
      if (match) return match[0].trim();
    }
  }

  // 2. Scan organic snippets with regex (best-effort fallback)
  for (const result of organic.slice(0, 4)) {
    const text = `${result.title || ''} ${result.snippet || ''}`;
    const match = text.match(PHONE_RE);
    if (match) {
      const candidate = match[0].trim();
      // Ignore short strings that are more likely years/zip codes than phones
      if (candidate.replace(/\D/g, '').length >= 7) return candidate;
    }
  }

  return null;
}

// ── Address extraction ─────────────────────────────────────────────────────
// Keys that Serper's knowledge graph uses for location/address information.
const ADDRESS_ATTR_KEYS = [
  'Headquarters',
  'Address',
  'Location',
  'Office',
  'Main office',
  'Registered address',
];

/**
 * Extract headquarters / address from knowledge graph attributes.
 */
function extractAddress(attributes = {}) {
  for (const key of ADDRESS_ATTR_KEYS) {
    if (attributes[key]) return String(attributes[key]).trim();
  }
  return null;
}

// ── Official website extraction ────────────────────────────────────────────
// Domains that are aggregators/encyclopaedias — not the company's own site.
const NON_OFFICIAL_DOMAINS = [
  'wikipedia.org',
  'britannica.com',
  'crunchbase.com',
  'bloomberg.com',
  'forbes.com',
  'reuters.com',
  'finance.yahoo.com',
  'linkedin.com',
  'glassdoor.com',
  'indeed.com',
  'zoominfo.com',
  'dnb.com',
];

/**
 * Walk the organic results and return the first link that is NOT
 * a well-known aggregator / encyclopaedia / finance site.
 * This is almost always the company's own domain.
 */
function extractOfficialWebsite(organic = []) {
  for (const result of organic) {
    const link = result.link || '';
    try {
      const hostname = new URL(link).hostname.replace(/^www\./, '');
      const isAggregator = NON_OFFICIAL_DOMAINS.some((d) => hostname.endsWith(d));
      if (!isAggregator) return link;
    } catch {
      // Malformed URL — skip
    }
  }
  // Ultimate fallback: first organic result, whatever it is
  return organic[0]?.link || null;
}

// ── Known attribute keys to surface as structured metadata ─────────────────
const META_ATTR_KEYS = ['Founded', 'CEO', 'Founders', 'Employees', 'Revenue', 'Type'];

/**
 * Pull a curated subset of knowledge-graph attributes into a clean object.
 */
function extractMetadata(attributes = {}) {
  const meta = {};
  for (const key of META_ATTR_KEYS) {
    if (attributes[key]) meta[key] = String(attributes[key]).trim();
  }
  return meta;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Search for a company using Serper.dev and return structured data.
 *
 * Extracts:
 *  - officialWebsite  — company's own domain (filtered from aggregators)
 *  - phone            — customer-service / main phone number
 *  - address          — headquarters / registered address
 *  - description      — knowledge-graph summary paragraph
 *  - metadata         — curated KG attributes (Founded, CEO, etc.)
 *  - organic          — cleaned array of web results (for AI summarisation)
 *
 * The SERPER_API_KEY never leaves the server — it is read from process.env
 * inside serperClient (utils/apiClient.js) at request time.
 *
 * @param {string} companyName
 * @returns {Promise<CompanySearchResult>}
 */
export const searchCompany = async (companyName) => {
  logger.info(`[SerperService] Searching for company: "${companyName}"`);

  const response = await serperClient.post('/search', {
    q: companyName,         // plain company name gives best knowledge-graph hit
    num: 10,
    gl: 'us',
    hl: 'en',
  });

  const { knowledgeGraph = null, organic = [], answerBox = null } = response.data;
  const attributes = knowledgeGraph?.attributes || {};

  const officialWebsite  = extractOfficialWebsite(organic);
  const phone            = extractPhone(attributes, organic);
  const address          = extractAddress(attributes);
  const description      = knowledgeGraph?.description || null;
  const metadata         = extractMetadata(attributes);

  const formattedOrganic = organic.map((item) => ({
    title:    item.title    || '',
    link:     item.link     || '',
    snippet:  item.snippet  || '',
    position: item.position ?? null,
  }));

  logger.info(
    `[SerperService] Found — website: ${officialWebsite ?? 'n/a'} | ` +
    `phone: ${phone ?? 'n/a'} | address: ${address ?? 'n/a'}`
  );

  return {
    officialWebsite,
    phone,
    address,
    description,
    metadata,          // { Founded, CEO, Founders, … }
    organic: formattedOrganic,
    answerBox,
  };
};

/**
 * Lightweight search — returns only the organic results array.
 * Kept for backward compatibility with the legacy aiRoutes / aiController.
 *
 * @param {string} query
 * @param {number} [num=10]
 * @returns {Promise<Array>}
 */
export const search = async (query, num = 10) => {
  logger.info(`[SerperService] Quick search for: "${query}"`);
  const response = await serperClient.post('/search', { q: query, num, gl: 'us', hl: 'en' });
  const organic  = response.data?.organic || [];
  return organic.map((item) => ({
    title:    item.title    || '',
    link:     item.link     || '',
    snippet:  item.snippet  || '',
    position: item.position ?? null,
  }));
};
