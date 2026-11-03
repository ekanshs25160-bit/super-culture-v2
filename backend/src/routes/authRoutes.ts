import { Router, Request, Response } from 'express';
import { env } from '../config/env.js';
import {
  PASSCODE_COOKIE_NAME,
  PASSCODE_COOKIE_VALUE,
  getPasscodeCookieOptions,
} from '../middleware/auth.js';

const router = Router();

/**
 * Validate passcode and issue signed httpOnly cookie
 * POST /api/auth/passcode
 */
router.post('/passcode', (req: Request, res: Response): void => {
  if (!env.appPasscode) {
    res.json({
      ok: true,
      authenticated: true,
      required: false,
      message: 'No passcode configured on this server',
    });
    return;
  }

  const { passcode } = req.body || {};

  if (!passcode || typeof passcode !== 'string') {
    res.status(400).json({ error: 'Passcode is required' });
    return;
  }

  if (passcode.trim() !== env.appPasscode) {
    res.status(401).json({ error: 'Invalid passcode' });
    return;
  }

  res.cookie(PASSCODE_COOKIE_NAME, PASSCODE_COOKIE_VALUE, getPasscodeCookieOptions());
  res.json({
    ok: true,
    authenticated: true,
    message: 'Passcode verified successfully',
  });
});

/**
 * Check authentication status
 * GET /api/auth/status
 */
router.get('/status', (req: Request, res: Response): void => {
  if (!env.appPasscode) {
    res.json({ required: false, authenticated: true });
    return;
  }

  const isAuthenticated = req.signedCookies?.[PASSCODE_COOKIE_NAME] === PASSCODE_COOKIE_VALUE;
  res.json({
    required: true,
    authenticated: isAuthenticated,
  });
});

/**
 * Clear passcode cookie
 * POST /api/auth/logout
 */
router.post('/logout', (_req: Request, res: Response): void => {
  res.clearCookie(PASSCODE_COOKIE_NAME, {
    path: '/',
    httpOnly: true,
    secure: !env.isDev,
    sameSite: env.isDev ? 'lax' : 'none',
  });
  res.json({ ok: true, authenticated: false });
});

export default router;
