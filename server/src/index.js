// ── Environment ────────────────────────────────────────────────────────────
// MUST be the first import so all process.env vars are populated before any
// other module reads them (ES module imports are hoisted; dotenv/config runs
// as a side-effect before subsequent imports are evaluated).
import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';

import companyRoutes from './routes/companyRoutes.js';
import aiRoutes from './routes/aiRoutes.js';
import researchRoutes from './routes/researchRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Startup: validate required environment variables ───────────────────────
const REQUIRED_VARS = ['PORT', 'NODE_ENV', 'OPENROUTER_API_KEY', 'SERPER_API_KEY'];
const missing = REQUIRED_VARS.filter((v) => !process.env[v]);
if (missing.length > 0) {
  console.error(`[startup] Missing required environment variables: ${missing.join(', ')}`);
  console.error('[startup] Copy .env.example → .env and fill in the values.');
  process.exit(1);
}

const isMock = process.env.MOCK_MODE === 'true';
const PORT   = Number(process.env.PORT) || 5000;
const ENV    = process.env.NODE_ENV;

// ── App ────────────────────────────────────────────────────────────────────
const app = express();

// ── Middleware ─────────────────────────────────────────────────────────────

// Security and performance
app.use(helmet({
  contentSecurityPolicy: false, // Disabled for simplicity with React/Vite in this setup
}));
app.use(compression());

// CORS: allow the Vite dev server and same-origin production requests
app.use(
  cors({
    origin: [
      'http://localhost:5173', // Vite dev server
      'http://localhost:4173', // Vite preview
      `http://localhost:${PORT}`,
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// JSON body parsing (Content-Type: application/json)
app.use(express.json({ limit: '1mb' }));

// URL-encoded body parsing (HTML forms)
app.use(express.urlencoded({ extended: true }));

// ── Routes ─────────────────────────────────────────────────────────────────

/**
 * GET /api/health
 * Liveness probe — confirms the server is up and reports its mode.
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    env: ENV,
    mock: isMock,
    timestamp: new Date().toISOString(),
  });
});

// POST /api/research, POST /api/pdf
app.use('/api', researchRoutes);

// CRUD company routes
app.use('/api/companies', companyRoutes);

// Legacy AI routes
app.use('/api/ai', aiRoutes);

// Root info for API
app.get('/api', (req, res) => {
  res.json({ message: 'AI-powered Company Research Assistant API', version: '1.0.0' });
});

// ── Serve Frontend ─────────────────────────────────────────────────────────
if (ENV === 'production') {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));

  // Catch-all route to return index.html for React Router
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.json({ message: 'API running in development. Use Vite dev server for frontend.' });
  });
}

// ── 404 handler ────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.path}` });
});

// ── Global error handler ───────────────────────────────────────────────────
// Must have exactly 4 params so Express recognises it as an error handler.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error('[error]', err.stack || err.message);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    error: ENV === 'production' ? 'Internal server error' : (err.message || 'Something went wrong'),
  });
});

// ── Listen ─────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[${ENV}] Server running on http://localhost:${PORT}`);
  console.log(`  GET  http://localhost:${PORT}/api/health`);
  console.log(`  POST http://localhost:${PORT}/api/research${isMock ? '  (mock mode)' : ''}`);
});