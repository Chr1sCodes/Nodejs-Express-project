import { unauthorized } from '../errors.js';

export const SESSION_COOKIE = 'sid';

export function parseCookies(header = '') {
  const cookies = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    try {
      cookies[key] = decodeURIComponent(part.slice(idx + 1).trim());
    } catch {
      // Ignore malformed cookie values.
    }
  }
  return cookies;
}

/** Attaches `req.user` when a valid session cookie is present. */
export function loadSession({ sessions, users }) {
  return (req, _res, next) => {
    const token = parseCookies(req.headers.cookie)[SESSION_COOKIE];
    if (token) {
      const userId = sessions.findUserId(token);
      if (userId) {
        req.user = users.findById(userId);
        req.sessionToken = token;
      }
    }
    next();
  };
}

export function requireAuth(req, _res, next) {
  if (!req.user) return next(unauthorized());
  next();
}

/**
 * CSRF defence in depth (alongside SameSite=Strict cookies): state-changing requests must be
 * JSON, which browsers can't send cross-origin without a CORS preflight.
 */
export function requireJson(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  // Bodyless requests (e.g. logout) carry no payload, so only reject non-empty, non-JSON bodies.
  const hasBody = req.headers['transfer-encoding'] !== undefined || Number(req.headers['content-length']) > 0;
  if (hasBody && !req.is('application/json')) {
    return res.status(415).json({ error: 'Content-Type must be application/json' });
  }
  next();
}
