import express from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createUserRepository } from './data/userRepository.js';
import { createSessionRepository } from './data/sessionRepository.js';
import { createAccountRepository } from './data/accountRepository.js';
import { createAuthRouter } from './routes/auth.js';
import { createAccountRouter } from './routes/accounts.js';
import { loadSession, requireJson } from './middleware/auth.js';
import { AppError } from './errors.js';

/**
 * Builds the Express app. The database is injected so tests can use an in-memory instance.
 */
export function createApp({
  db,
  staticDir,
  secureCookies = false,
  loginRateLimit = { windowMs: 15 * 60 * 1000, max: 20 },
} = {}) {
  const app = express();
  const users = createUserRepository(db);
  const sessions = createSessionRepository(db);
  const accounts = createAccountRepository(db);

  app.disable('x-powered-by');
  app.use((_req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'same-origin',
    });
    next();
  });

  app.use('/api', requireJson, express.json({ limit: '10kb' }), (_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use('/api', loadSession({ sessions, users }));

  app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
  app.use('/api/auth', createAuthRouter({ db, users, sessions, accounts, secureCookies, loginRateLimit }));
  app.use('/api', createAccountRouter({ accounts }));
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  // In production, serve the built React client and fall back to index.html for client routes.
  if (staticDir && existsSync(staticDir)) {
    app.use(express.static(staticDir));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(join(staticDir, 'index.html')));
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof AppError) {
      return res.status(err.status).json({ error: err.message, details: err.details });
    }
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Payload too large' });
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  app.locals.sessions = sessions;
  return app;
}
