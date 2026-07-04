/**
 * Centralized Axios instance for all frontend API calls.
 *
 * Uses a relative baseURL ('/api') so requests are handled by the Vite
 * proxy in development (→ localhost:5000) and the same-origin server
 * in production. No API keys or external hostnames ever appear here.
 */
import axios from 'axios';

const apiClient = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

export default apiClient;
