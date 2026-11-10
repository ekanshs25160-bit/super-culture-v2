import rateLimit from 'express-rate-limit';
import type { Request } from 'express';
import { verifyStreamToken } from '../services/tokenService.js';

export function hasValidSignedStreamToken(req: Request): boolean {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return false;
  }
  const token = typeof req.query?.t === 'string' ? req.query.t : undefined;
  if (!token) {
    return false;
  }
  const paramId = typeof req.params?.videoId === 'string' ? req.params.videoId : undefined;
  const pathMatch = req.path?.match(/\/stream\/([^/?#]+)/);
  const videoId = paramId || pathMatch?.[1];
  if (!videoId) {
    return false;
  }
  const verification = verifyStreamToken(videoId, token);
  return verification.valid && !verification.expired;
}

// General API rate limiter
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // 300 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => hasValidSignedStreamToken(req),
  handler: (_req, res) => {
    res.status(429).json({
      error: 'Too many requests, please try again later.',
    });
  },
});

// Stricter limiter for AI endpoints (/api/ai/*)
export const aiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 AI calls per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: 'Too many AI requests from this IP, please try again later.',
    });
  },
});

// Limiter for POST /api/music/stream-url (60/min per IP); skips GET/HEAD /stream/:id with valid signed token
export const streamRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 stream-url requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => hasValidSignedStreamToken(req),
  handler: (_req, res) => {
    res.status(429).json({
      error: 'Too many audio stream requests from this IP, please slow down.',
    });
  },
});

// Stricter limiter for passcode auth attempts
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 passcode attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      error: 'Too many failed passcode attempts. Please wait 15 minutes.',
    });
  },
});
