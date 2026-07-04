import axios from 'axios';
import * as cheerio from 'cheerio';
import logger from '../utils/logger.js';

// ── Allowed paths ──────────────────────────────────────────────────────────
// Only these specific paths will ever be fetched — nothing else.
export const CRAWL_PATHS = [
  '/',
  '/about',
  '/products',
  '/services',
  '/solutions',
  '/contact',
  '/pricing',
];

// ── Skip patterns ──────────────────────────────────────────────────────────
// If the *final* URL (after redirects) matches any of these, the page is
// skipped — no content is extracted and it is not counted as visited.
const SKIP_URL_PATTERNS = [
  /\/login/i,
  /\/signin/i,
  /\/sign-in/i,
  /\/register/i,
  /\/signup/i,
  /\/sign-up/i,
  /\/auth/i,
  /\/privacy/i,
  /\/privacy-policy/i,
  /\/terms/i,
  /\/terms-of-service/i,
  /\/terms-and-conditions/i,
  /\/cookie/i,
  /\/legal/i,
  /\/gdpr/i,
];

// ── Noise selectors ────────────────────────────────────────────────────────
// Removed from the DOM before text extraction to strip boilerplate.
const NOISE_SELECTORS = [
  'script',
  'style',
  'noscript',
  'iframe',
  'nav',
  'footer',
  'header',
  'aside',
  '[aria-hidden="true"]',
  '[role="banner"]',
  '[role="navigation"]',
  '[role="complementary"]',
  '.cookie-banner',
  '.cookie-notice',
  '.modal',
  '.popup',
  '.overlay',
  '.advertisement',
  '.ad',
  '[class*="cookie"]',
  '[class*="newsletter"]',
  '[id*="cookie"]',
];

// ── HTTP client ────────────────────────────────────────────────────────────
// Separate axios instance for crawling — distinct from the API clients in
// apiClient.js. No API key is attached; this only fetches public HTML pages.
const crawlClient = axios.create({
  timeout: 12000,
  headers: {
    // Mimic a real browser to avoid bot-detection blocks on most sites.
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
      'Chrome/124.0.0.0 Safari/537.36',
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
  },
  // Follow up to 5 redirects so we land on the actual page.
  maxRedirects: 5,
  // Treat 4xx/5xx as resolved (we inspect status manually) rather than throwing.
  validateStatus: () => true,
});

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Return true if the URL should be skipped (login, privacy, terms, etc.).
 * Checks the path portion only — not the domain.
 * @param {string} url  Absolute URL
 */
function isSkippedUrl(url) {
  try {
    const { pathname } = new URL(url);
    return SKIP_URL_PATTERNS.some((re) => re.test(pathname));
  } catch {
    return false;
  }
}

/**
 * Extract clean text from an HTML string using Cheerio.
 *
 * Steps:
 *  1. Remove all noise elements (nav, footer, scripts, etc.)
 *  2. Grab the body text
 *  3. Collapse whitespace, remove excessive blank lines
 *  4. Truncate to maxChars so we don't blow up the AI prompt
 *
 * @param {string} html       Raw HTML from the page
 * @param {number} maxChars   Maximum characters to return (default 3000)
 * @returns {{ title: string, text: string }}
 */
function extractContent(html, maxChars = 3000) {
  const $ = cheerio.load(html);

  // Page title
  const title =
    $('title').first().text().trim() ||
    $('h1').first().text().trim() ||
    '';

  // Remove noise
  NOISE_SELECTORS.forEach((sel) => $(sel).remove());

  // Collect visible text nodes from body
  const raw = $('body').text();

  // Normalise whitespace: collapse runs of spaces/tabs, limit to 2 blank lines
  const cleaned = raw
    .replace(/[ \t]+/g, ' ')           // collapse horizontal space
    .replace(/\n{3,}/g, '\n\n')        // at most 2 consecutive newlines
    .replace(/^\s+|\s+$/gm, '')        // trim each line
    .trim();

  // Truncate — first maxChars characters + ellipsis if cut
  const text =
    cleaned.length > maxChars
      ? cleaned.slice(0, maxChars) + '…'
      : cleaned;

  return { title, text };
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * @typedef {Object} CrawledPage
 * @property {string} path       - Relative path that was crawled (e.g. '/about')
 * @property {string} url        - Final absolute URL (after any redirects)
 * @property {string} title      - Page <title> or first <h1>
 * @property {string} text       - Cleaned visible text (≤ 3000 chars)
 * @property {number} statusCode - HTTP response status
 */

/**
 * Crawl a company website across a fixed set of allowed paths.
 *
 * Rules enforced:
 *  ✓ Only CRAWL_PATHS are ever fetched (no link following)
 *  ✓ Duplicate URLs are skipped (normalised Set comparison)
 *  ✓ Login / privacy / terms pages are detected and skipped
 *  ✓ Pages with < 80 chars of extracted text are silently dropped
 *  ✓ HTTP errors and network failures are caught per-page; crawl continues
 *
 * @param {string} baseUrl  The company's official website (from Serper)
 * @returns {Promise<CrawledPage[]>}
 */
export const crawlCompanyWebsite = async (baseUrl) => {
  if (!baseUrl) {
    logger.warn('[Crawler] No base URL provided — skipping crawl');
    return [];
  }

  // Normalise: strip trailing slash so URL construction is consistent
  const base = baseUrl.replace(/\/$/, '');
  const visitedUrls = new Set();
  const pages = [];

  logger.info(`[Crawler] Starting crawl of ${base} (${CRAWL_PATHS.length} paths)`);

  for (const path of CRAWL_PATHS) {
    const targetUrl = path === '/' ? `${base}/` : `${base}${path}`;

    // ── Duplicate check ──────────────────────────────────────────────────
    if (visitedUrls.has(targetUrl)) {
      logger.debug(`[Crawler] Skipping duplicate: ${targetUrl}`);
      continue;
    }

    // ── Skip-pattern check on request URL ───────────────────────────────
    if (isSkippedUrl(targetUrl)) {
      logger.debug(`[Crawler] Skipping restricted path: ${targetUrl}`);
      continue;
    }

    visitedUrls.add(targetUrl);

    try {
      logger.debug(`[Crawler] Fetching: ${targetUrl}`);

      const response = await crawlClient.get(targetUrl);
      const finalUrl = response.request?.res?.responseUrl || targetUrl;

      // ── Skip-pattern check on final URL (post-redirect) ───────────────
      if (isSkippedUrl(finalUrl)) {
        logger.debug(`[Crawler] Redirect landed on restricted URL: ${finalUrl}`);
        continue;
      }

      // ── Skip non-HTML responses (JSON APIs, PDFs, etc.) ───────────────
      const contentType = response.headers['content-type'] || '';
      if (!contentType.includes('text/html')) {
        logger.debug(`[Crawler] Skipping non-HTML response at ${targetUrl}: ${contentType}`);
        continue;
      }

      // ── Skip error responses ───────────────────────────────────────────
      if (response.status >= 400) {
        logger.debug(`[Crawler] HTTP ${response.status} at ${targetUrl} — skipping`);
        continue;
      }

      // ── Extract content ────────────────────────────────────────────────
      const { title, text } = extractContent(response.data);

      // Skip pages with too little content (likely 404 shell pages, empty redirects)
      if (text.length < 80) {
        logger.debug(`[Crawler] Too little content at ${targetUrl} (${text.length} chars) — skipping`);
        continue;
      }

      // ── Deduplicate by final URL (after redirects) ─────────────────────
      if (visitedUrls.has(finalUrl) && finalUrl !== targetUrl) {
        logger.debug(`[Crawler] Redirect duplicate: ${finalUrl} — skipping`);
        continue;
      }
      visitedUrls.add(finalUrl);

      pages.push({ path, url: finalUrl, title, text, statusCode: response.status });

      logger.info(`[Crawler] ✓ ${path} — "${title}" (${text.length} chars)`);
    } catch (err) {
      // Network timeout, DNS failure, SSL error, etc. — skip this path
      logger.warn(`[Crawler] Failed to fetch ${targetUrl}: ${err.message}`);
    }
  }

  logger.info(`[Crawler] Done — ${pages.length}/${CRAWL_PATHS.length} pages crawled`);
  return pages;
};
