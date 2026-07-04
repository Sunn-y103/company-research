import axios from 'axios';

/**
 * Axios client pre-configured for Serper.dev.
 * Auth is via X-API-KEY header — key sourced from server/.env only.
 */
export const serperClient = axios.create({
  baseURL: 'https://google.serper.dev',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'X-API-KEY': process.env.SERPER_API_KEY,
  },
});

/**
 * Axios client pre-configured for OpenRouter.ai.
 * Auth is via Bearer token — key sourced from server/.env only.
 */
export const openrouterClient = axios.create({
  baseURL: 'https://openrouter.ai/api/v1',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
    'X-Title': 'Company Research Assistant',
  },
});

// Shared response error interceptor
const errorInterceptor = (error) => {
  const service = error.config?.baseURL || 'unknown';
  console.error(`[API Client] Request to ${service} failed: ${error.message}`);
  return Promise.reject(error);
};

serperClient.interceptors.response.use((r) => r, errorInterceptor);
openrouterClient.interceptors.response.use((r) => r, errorInterceptor);