import { CorsOptions } from 'cors';
import { env } from './env.js';

export const isOriginAllowed = (origin?: string): boolean => {
  if (!origin) return true;
  const normalizedOrigin = origin.replace(/\/$/, '');

  // 1. Check configured CORS_ORIGIN allowlist
  if (env.corsOrigins.includes(normalizedOrigin)) {
    return true;
  }

  // 2. Localhost origins permitted ONLY in non-production environments
  if (env.isDev) {
    const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalizedOrigin);
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
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-guest-id', 'x-app-passcode', 'Range'],
    exposedHeaders: ['Content-Range', 'Accept-Ranges', 'Content-Length', 'Cache-Control'],
  };
};
