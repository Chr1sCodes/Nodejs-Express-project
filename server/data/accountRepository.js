import { randomInt } from 'node:crypto';
import { inTransaction } from './db.js';
import { notFound, unprocessable, badRequest } from '../errors.js';

export const ACCOUNT_TYPES = ['checking', 'savings'];

const toAccount = (row) =>
  row && {
    id: row.id,
    type: row.type,
    number: row.number,
    balanceCents: row.balance_cents,
    createdAt: row.created_at,
  };

const toTransaction = (row) => ({
  id: row.id,
  accountId: row.account_id,
  accountType: row.account_type,
  accountNumber: row.account_number,
  type: row.type,
  amountCents: row.amount_cents,
  balanceAfterCents: row.balance_after_cents,
  description: row.description,
  counterparty: row.counterparty,
  createdAt: row.created_at,
});

const mask = (number) => `••${number.slice(-4)}`;

/**
 * Data-access layer for accounts and money movement. Every balance change writes a
 * ledger row in the same DB transaction so balances and history never drift apart.
 */
export function createAccountRepository(db) {
  const getAccount = db.prepare('SELECT * FROM accounts WHERE id = ?');
  const setBalance = db.prepare('UPDATE accounts SET balance_cents = ? WHERE id = ?');
  const addEntry = db.prepare(
    `INSERT INTO transactions
       (account_id, type, amount_cents, balance_after_cents, description, counterparty)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  const credit = (account, cents, type, description, counterparty = null) => {
    const balance = account.balance_cents + cents;
    setBalance.run(balance, account.id);
    addEntry.run(account.id, type, cents, balance, description, counterparty);
    return balance;
  };

  const debit = (account, cents, type, description, counterparty = null) => {
    if (account.balance_cents < cents) throw unprocessable('Insufficient funds');
    const balance = account.balance_cents - cents;
    setBalance.run(balance, account.id);
    addEntry.run(account.id, type, cents, balance, description, counterparty);
    return balance;
  };

  const ownedAccount = (accountId, userId) => {
    const row = getAccount.get(accountId);
    if (!row || row.user_id !== userId) throw notFound('Account not found');
    return row;
  };

  const generateNumber = () => {
    const exists = db.prepare('SELECT 1 FROM accounts WHERE number = ?');
    for (;;) {
      const number = String(randomInt(1_000_000_000, 10_000_000_000));
      if (!exists.get(number)) return number;
    }
  };

  return {
    open(userId, type) {
      const { lastInsertRowid } = db
        .prepare('INSERT INTO accounts (user_id, type, number) VALUES (?, ?, ?)')
        .run(userId, type, generateNumber());
      return toAccount(getAccount.get(lastInsertRowid));
    },

    listByUser(userId) {
      return db
        .prepare('SELECT * FROM accounts WHERE user_id = ? ORDER BY id')
        .all(userId)
        .map(toAccount);
    },

    findForUser(accountId, userId) {
      return toAccount(ownedAccount(accountId, userId));
    },

    deposit(userId, accountId, cents, description = 'Deposit') {
      return inTransaction(db, () => {
        const account = ownedAccount(accountId, userId);
        credit(account, cents, 'deposit', description);
        return toAccount(getAccount.get(accountId));
      });
    },

    withdraw(userId, accountId, cents, description = 'Withdrawal') {
      return inTransaction(db, () => {
        const account = ownedAccount(accountId, userId);
        debit(account, cents, 'withdrawal', description);
        return toAccount(getAccount.get(accountId));
      });
    },

    /**
     * Moves money from one of the user's accounts to any account by number.
     */
    transfer(userId, fromAccountId, toAccountNumber, cents, description) {
      return inTransaction(db, () => {
        const from = ownedAccount(fromAccountId, userId);
        const to = db.prepare('SELECT * FROM accounts WHERE number = ?').get(toAccountNumber);
        if (!to) throw notFound('Destination account not found');
        if (to.id === from.id) throw badRequest('Cannot transfer to the same account');

        const internal = to.user_id === userId;
        const sender = db.prepare('SELECT name FROM users WHERE id = ?').get(userId).name;
        const recipient = internal
          ? sender
          : db.prepare('SELECT name FROM users WHERE id = ?').get(to.user_id).name;

        const outLabel = internal ? `Your ${to.type} ${mask(to.number)}` : `${recipient} ${mask(to.number)}`;
        const inLabel = internal ? `Your ${from.type} ${mask(from.number)}` : sender;
        const memo = description || 'Transfer';

        debit(from, cents, 'transfer_out', memo, outLabel);
        credit(to, cents, 'transfer_in', memo, inLabel);
        return toAccount(getAccount.get(from.id));
      });
    },

    transactions(userId, { accountId, limit = 50 } = {}) {
      const params = [userId];
      let sql = `
        SELECT t.*, a.type AS account_type, a.number AS account_number
          FROM transactions t
          JOIN accounts a ON a.id = t.account_id
         WHERE a.user_id = ?`;
      if (accountId) {
        sql += ' AND a.id = ?';
        params.push(accountId);
      }
      sql += ' ORDER BY t.id DESC LIMIT ?';
      params.push(limit);
      return db.prepare(sql).all(...params).map(toTransaction);
    },

    /** Totals across all of the user's accounts, plus money in/out for the current month. */
    summary(userId) {
      const { total } = db
        .prepare('SELECT COALESCE(SUM(balance_cents), 0) AS total FROM accounts WHERE user_id = ?')
        .get(userId);
      // Internal transfers between the user's own accounts are excluded from in/out totals.
      const { moneyIn, moneyOut } = db
        .prepare(
          `SELECT
             COALESCE(SUM(CASE WHEN t.type IN ('deposit', 'transfer_in') THEN t.amount_cents END), 0) AS moneyIn,
             COALESCE(SUM(CASE WHEN t.type IN ('withdrawal', 'transfer_out') THEN t.amount_cents END), 0) AS moneyOut
             FROM transactions t
             JOIN accounts a ON a.id = t.account_id
            WHERE a.user_id = ?
              AND t.created_at >= strftime('%Y-%m-01T00:00:00Z', 'now')
              AND (t.counterparty IS NULL OR t.counterparty NOT LIKE 'Your %')`
        )
        .get(userId);
      return { totalCents: total, monthInCents: moneyIn, monthOutCents: moneyOut };
    },
  };
}
