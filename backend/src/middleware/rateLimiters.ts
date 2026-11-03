import rateLimit from 'express-rate-limit';

// General API rate limiter
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // 300 requests per window
  standardHeaders: true,
  legacyHeaders: false,
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

// Stricter limiter for streaming proxy (/api/music/stream/* and /api/yt/stream/*)
export const streamRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 stream requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
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
