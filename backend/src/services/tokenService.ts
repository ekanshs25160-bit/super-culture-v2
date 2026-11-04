import crypto from 'node:crypto';
import { env } from '../config/env.js';

export interface TokenVerificationResult {
  valid: boolean;
  expired: boolean;
}

/**
 * Creates an HMAC token for a given videoId with a 2-hour expiry by default.
 * Format: `${expiryTimestampMs}.${hexHmac}`
 */
export const createStreamToken = (
  videoId: string,
  expiryDurationMs = 2 * 60 * 60 * 1000
): string => {
  const expiry = Date.now() + expiryDurationMs;
  const hmac = crypto
    .createHmac('sha256', env.streamSecret)
    .update(`${videoId}:${expiry}`)
    .digest('hex');
  return `${expiry}.${hmac}`;
};

/**
 * Verifies an HMAC stream token for videoId using constant-time comparison.
 */
export const verifyStreamToken = (
  videoId: string,
  token?: string
): TokenVerificationResult => {
  if (!token || typeof token !== 'string') {
    return { valid: false, expired: false };
  }

  const parts = token.split('.');
  if (parts.length !== 2) {
    return { valid: false, expired: false };
  }

  const [expiryStr, receivedHmac] = parts;
  const expiry = Number(expiryStr);
  if (isNaN(expiry) || !receivedHmac) {
    return { valid: false, expired: false };
  }

  const expectedHmac = crypto
    .createHmac('sha256', env.streamSecret)
    .update(`${videoId}:${expiry}`)
    .digest('hex');

  // Constant-time comparison to prevent timing attacks
  const receivedBuf = Buffer.from(receivedHmac, 'hex');
  const expectedBuf = Buffer.from(expectedHmac, 'hex');

  if (
    receivedBuf.length !== expectedBuf.length ||
    !crypto.timingSafeEqual(receivedBuf, expectedBuf)
  ) {
    return { valid: false, expired: false };
  }

  // Token is cryptographically valid, check expiry
  if (Date.now() > expiry) {
    return { valid: true, expired: true };
  }

  return { valid: true, expired: false };
};
