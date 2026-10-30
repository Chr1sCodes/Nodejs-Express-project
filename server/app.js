import express from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { createUserRepository } from './data/userRepository.js';
import { createSessionRepository } from './data/sessionRepository.js';
import { createAccountRepository } from './data/accountRepository.js';
import { createAuthRouter } from './routes/auth.js';
import { createAccountRouter } from './routes/accounts.js';
import { loadSession, requireJson } from './middleware/auth.js';
import { createMarket } from './services/market.js';
import { requestId, errorLogger, errorHandler } from './middleware/errors.js';

/**
 * Builds the Express app. The database is injected so tests can use an in-memory instance.
 */
export function createApp({
  db,
  staticDir,
  secureCookies = false,
  loginRateLimit = { windowMs: 15 * 60 * 1000, max: 20 },
  market = createMarket(),
  logger = console,
} = {}) {
  const app = express();
  const users = createUserRepository(db);
  const sessions = createSessionRepository(db);
  const accounts = createAccountRepository(db);

  app.disable('x-powered-by');
  app.use(requestId());
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
  app.get('/api/market/popular', (_req, res) => res.json(market.snapshot()));
  app.use('/api/auth', createAuthRouter({ db, users, sessions, accounts, secureCookies, loginRateLimit }));
  app.use('/api', createAccountRouter({ accounts }));
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found' }));

  // In production, serve the built React client and fall back to index.html for client routes.
  if (staticDir && existsSync(staticDir)) {
    app.use(express.static(staticDir));
    app.get(/^(?!\/api).*/, (_req, res) => res.sendFile(join(staticDir, 'index.html')));
  }

  app.use(errorLogger({ logger }));
  app.use(errorHandler());

  app.locals.sessions = sessions;
  return app;
}
