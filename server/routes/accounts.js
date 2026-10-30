import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { badRequest } from '../errors.js';

const MAX_AMOUNT_CENTS = 100_000_000; // $1,000,000 per transaction

/** Parses a dollar amount ("12.34" or 12.34) into integer cents, avoiding float drift. */
export function parseAmount(value) {
  const str = typeof value === 'number' ? String(value) : typeof value === 'string' ? value.trim() : '';
  const match = /^(\d{1,9})(?:\.(\d{1,2}))?$/.exec(str);
  if (!match) throw badRequest('amount must be a positive number with at most 2 decimal places');
  const cents = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  if (cents <= 0) throw badRequest('amount must be greater than zero');
  if (cents > MAX_AMOUNT_CENTS) throw badRequest('amount exceeds the $1,000,000 limit');
  return cents;
}

function parseDescription(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string') throw badRequest('description must be a string');
  const trimmed = value.trim();
  if (trimmed.length > 140) throw badRequest('description must be 140 characters or fewer');
  return trimmed || fallback;
}

function parseId(value, name = 'id') {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw badRequest(`Invalid ${name}`);
  return id;
}

export function createAccountRouter({ accounts }) {
  const router = Router();
  router.use(requireAuth);

  router.get('/accounts', (req, res) => {
    res.json({
      accounts: accounts.listByUser(req.user.id),
      summary: accounts.summary(req.user.id),
    });
  });

  router.get('/accounts/:id', (req, res) => {
    res.json(accounts.findForUser(parseId(req.params.id), req.user.id));
  });

  router.get('/transactions', (req, res) => {
    const accountId = req.query.accountId ? parseId(req.query.accountId, 'accountId') : undefined;
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    res.json(accounts.transactions(req.user.id, { accountId, limit }));
  });

  router.post('/accounts/:id/deposit', (req, res) => {
    const cents = parseAmount(req.body?.amount);
    const description = parseDescription(req.body?.description, 'Deposit');
    res.json(accounts.deposit(req.user.id, parseId(req.params.id), cents, description));
  });

  router.post('/accounts/:id/withdraw', (req, res) => {
    const cents = parseAmount(req.body?.amount);
    const description = parseDescription(req.body?.description, 'Withdrawal');
    res.json(accounts.withdraw(req.user.id, parseId(req.params.id), cents, description));
  });

  router.post('/transfers', (req, res) => {
    const fromAccountId = parseId(req.body?.fromAccountId, 'fromAccountId');
    const toAccountNumber = String(req.body?.toAccountNumber ?? '').replace(/\s/g, '');
    if (!/^\d{10}$/.test(toAccountNumber)) throw badRequest('toAccountNumber must be 10 digits');
    const cents = parseAmount(req.body?.amount);
    const description = parseDescription(req.body?.description, 'Transfer');
    res.json(accounts.transfer(req.user.id, fromAccountId, toAccountNumber, cents, description));
  });

  return router;
}
