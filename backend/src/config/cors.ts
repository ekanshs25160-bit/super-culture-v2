import { CorsOptions } from 'cors';
import { env } from './env.js';

// Default permitted production origins for Super Culture
const DEFAULT_ALLOWED_ORIGINS = [
  'https://super-culture-v2.onrender.com',
  'https://super-culture.onrender.com',
  'https://super-culture-backend.onrender.com',
];

export const isOriginAllowed = (origin?: string): boolean => {
  if (!origin) return true;
  const normalizedOrigin = origin.replace(/\/$/, '').toLowerCase();

  // 1. Explicit allowlist from CORS_ORIGIN
  if (env.corsOrigins.some((o) => o.toLowerCase() === normalizedOrigin)) {
    return true;
  }

  // 2. Default production deployment origins
  if (DEFAULT_ALLOWED_ORIGINS.some((o) => o.toLowerCase() === normalizedOrigin)) {
    return true;
  }

  // 3. Automatically permit Render deployed frontends (*.onrender.com and *.render.com)
  if (/^https?:\/\/[a-z0-9-]+\.(onrender\.com|render\.com)$/i.test(normalizedOrigin)) {
    return true;
  }

  // 4. Wildcard matching for configured CORS_ORIGIN patterns (e.g. *.domain.com or *)
  for (const pattern of env.corsOrigins) {
    if (pattern === '*' && process.env.NODE_ENV !== 'test') {
      return true;
    }
    if (pattern.includes('*') && pattern !== '*') {
      const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
      if (new RegExp(`^${escaped}$`, 'i').test(normalizedOrigin)) {
        return true;
      }
    }
  }

  // 5. Localhost origins permitted ONLY in non-production environments
  if (env.isDev) {
    const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalizedOrigin);
    if (isLocalhost) {
      return true;
    }
  }

  return false;
};

export const getCorsOptions = (): CorsOptions => {
  return {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS origin not allowed: ${origin}`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-guest-id',
      'x-app-passcode',
      'Range',
      'Accept',
      'Origin',
      'X-Requested-With',
    ],
    exposedHeaders: [
      'Content-Range',
      'Accept-Ranges',
      'Content-Length',
      'Cache-Control',
      'Content-Type',
    ],
    maxAge: 86400, // Cache preflight for 24 hours
  };
};
