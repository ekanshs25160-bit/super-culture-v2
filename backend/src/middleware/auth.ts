import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env.js';

export const PASSCODE_COOKIE_NAME = 'sc_passcode';
export const PASSCODE_COOKIE_VALUE = 'authenticated';

export const getPasscodeCookieOptions = () => ({
  httpOnly: true,
  secure: !env.isDev,
  sameSite: (env.isDev ? 'lax' : 'none') as 'lax' | 'none',
  signed: true,
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/',
});

/**
 * Gate middleware for API routes when APP_PASSCODE is configured.
 * Excludes health/ready probes, auth routes, and token-signed audio stream endpoints.
 */
export const passcodeGate = (req: Request, res: Response, next: NextFunction): void => {
  // If APP_PASSCODE is not set, access control gate is inactive
  if (!env.appPasscode) {
    next();
    return;
  }

  // Probe routes, auth routes, and stream route bypass
  // (Stream requests are signed with HMAC token so <audio> tags need no cookies)
  const path = req.path;
  if (
    path === '/health' ||
    path === '/ready' ||
    path.startsWith('/auth') ||
    path.startsWith('/api/auth') ||
    path.includes('/stream/')
  ) {
    next();
    return;
  }

  // Check signed cookie
  const signedCookie = req.signedCookies?.[PASSCODE_COOKIE_NAME];
  if (signedCookie === PASSCODE_COOKIE_VALUE) {
    next();
    return;
  }

  // Check optional header fallback (e.g. for API/CLI integrations)
  const headerPasscode = req.headers['x-app-passcode'];
  if (typeof headerPasscode === 'string' && headerPasscode === env.appPasscode) {
    next();
    return;
  }

  res.status(401).json({
    error: 'Passcode authentication required',
    authRequired: true,
  });
};
