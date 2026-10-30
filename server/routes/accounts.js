import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { parseAmount, parseDescription, parseId, parseAccountNumber } from '../validation.js';

export { parseAmount };

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
    const toAccountNumber = parseAccountNumber(req.body?.toAccountNumber);
    const cents = parseAmount(req.body?.amount);
    const description = parseDescription(req.body?.description, 'Transfer');
    res.json(accounts.transfer(req.user.id, fromAccountId, toAccountNumber, cents, description));
  });

  return router;
}
