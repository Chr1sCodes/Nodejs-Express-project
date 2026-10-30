import { Router } from 'express';
import { hashPassword, verifyPassword, DUMMY_HASH } from '../services/password.js';
import { SESSION_COOKIE } from '../middleware/auth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { badRequest, conflict, unauthorized } from '../errors.js';
import { inTransaction } from '../data/db.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SESSION_TTL_MS = 1000 * 60 * 60 * 8; // 8 hours

function validateRegistration(body) {
  const errors = [];
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';

  if (!name) errors.push('name is required');
  else if (name.length > 100) errors.push('name must be 100 characters or fewer');
  if (!EMAIL_RE.test(email) || email.length > 254) errors.push('a valid email is required');
  if (password.length < 8) errors.push('password must be at least 8 characters');
  else if (password.length > 128) errors.push('password must be 128 characters or fewer');
  else if (!/[A-Za-z]/.test(password) || !/\d/.test(password))
    errors.push('password must contain at least one letter and one number');

  return { name, email, password, errors };
}

export function createAuthRouter({ db, users, sessions, accounts, secureCookies, loginRateLimit }) {
  const router = Router();
  const limiter = rateLimit(loginRateLimit);

  const startSession = (res, userId) => {
    const { token } = sessions.create(userId, SESSION_TTL_MS);
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: secureCookies,
      maxAge: SESSION_TTL_MS,
      path: '/',
    });
  };

  router.post('/register', limiter, async (req, res) => {
    const { name, email, password, errors } = validateRegistration(req.body);
    if (errors.length) throw badRequest('Validation failed', errors);
    if (users.emailExists(email)) throw conflict('An account with this email already exists');

    const passwordHash = await hashPassword(password);
    const user = inTransaction(db, () => {
      const created = users.create({ name, email, passwordHash });
      accounts.open(created.id, 'checking');
      accounts.open(created.id, 'savings');
      return created;
    });

    startSession(res, user.id);
    res.status(201).json({ user });
  });

  router.post('/login', limiter, async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!email || !password) throw badRequest('Email and password are required');

    const record = users.findCredentialsByEmail(email);
    const ok = await verifyPassword(password, record?.passwordHash ?? DUMMY_HASH);
    if (!record || !ok) throw unauthorized('Invalid email or password');

    startSession(res, record.user.id);
    res.json({ user: record.user });
  });

  router.post('/logout', (req, res) => {
    if (req.sessionToken) sessions.delete(req.sessionToken);
    res.clearCookie(SESSION_COOKIE, { path: '/' });
    res.status(204).end();
  });

  // Returns { user: null } rather than 401 so the SPA can check auth state without an error.
  router.get('/me', (req, res) => res.json({ user: req.user ?? null }));

  return router;
}
