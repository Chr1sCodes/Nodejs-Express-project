import { randomUUID } from 'node:crypto';
import { AppError } from '../errors.js';

/** Tags each request with an ID (also sent as `X-Request-Id`) so logs can be matched to responses. */
export function requestId() {
  return (req, res, next) => {
    req.id = randomUUID();
    res.set('X-Request-Id', req.id);
    next();
  };
}

export function statusFor(err) {
  if (err instanceof AppError) return err.status;
  if (err.type === 'entity.parse.failed') return 400;
  if (err.type === 'entity.too.large') return 413;
  return 500;
}

/**
 * Logs every error as one JSON line, then passes it on to the error handler.
 * Server errors (5xx) are logged at `error` level with a stack trace; client errors (4xx) at `warn`.
 * Request bodies, cookies and query strings are never logged, so passwords and session tokens stay out of logs.
 */
export function errorLogger({ logger = console } = {}) {
  return (err, req, _res, next) => {
    const status = statusFor(err);
    const entry = {
      time: new Date().toISOString(),
      level: status >= 500 ? 'error' : 'warn',
      requestId: req.id,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      status,
      userId: req.user?.id ?? null,
      error: err.message,
    };
    if (status >= 500) {
      entry.name = err.name;
      entry.stack = err.stack;
      logger.error(JSON.stringify(entry));
    } else {
      logger.warn(JSON.stringify(entry));
    }
    next(err);
  };
}

/** Turns errors into JSON responses. Internal details are hidden; 500s include the request ID for support. */
export function errorHandler() {
  return (err, req, res, next) => {
    if (res.headersSent) return next(err);
    const status = statusFor(err);
    if (err instanceof AppError) {
      return res.status(status).json({ error: err.message, details: err.details });
    }
    if (status === 400) return res.status(400).json({ error: 'Invalid JSON' });
    if (status === 413) return res.status(413).json({ error: 'Payload too large' });
    res.status(500).json({ error: 'Internal server error', requestId: req.id });
  };
}
