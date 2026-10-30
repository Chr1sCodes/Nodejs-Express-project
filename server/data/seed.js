import { hashPassword } from '../services/password.js';
import { inTransaction } from './db.js';
import { DEMO_PASSWORD, DEMO_USERS, ACTIVITY } from './demoData.js';

export { DEMO_PASSWORD, DEMO_USERS };

const mask = (number) => `••${number.slice(-4)}`;

/**
 * Inserts demo users, accounts and transaction history. Only runs when the users table is empty,
 * so it never touches real data. Returns true if data was seeded.
 */
export async function seedDemoData(db) {
  const { count } = db.prepare('SELECT COUNT(*) AS count FROM users').get();
  if (count > 0) return false;

  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const now = Date.now();
  const timestamp = (daysAgo, i) => new Date(now - daysAgo * 86_400_000 + i * 60_000).toISOString();

  inTransaction(db, () => {
    const insertUser = db.prepare(
      'INSERT INTO users (name, email, password_hash, created_at) VALUES (?, ?, ?, ?)'
    );
    const insertAccount = db.prepare(
      'INSERT INTO accounts (user_id, type, number, created_at) VALUES (?, ?, ?, ?)'
    );
    const insertTx = db.prepare(
      `INSERT INTO transactions
         (account_id, type, amount_cents, balance_after_cents, description, counterparty, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const setBalance = db.prepare('UPDATE accounts SET balance_cents = ? WHERE id = ?');

    // "ada.checking" -> { id, number, type, owner, balance }
    const accounts = {};
    const created = timestamp(60, 0).replace('T', ' ').slice(0, 19);
    for (const u of DEMO_USERS) {
      const { lastInsertRowid: userId } = insertUser.run(u.name, u.email, passwordHash, created);
      for (const [type, number] of Object.entries(u.accounts)) {
        const { lastInsertRowid } = insertAccount.run(userId, type, number, created);
        accounts[`${u.key}.${type}`] = { id: lastInsertRowid, number, type, owner: u, balance: 0 };
      }
    }

    const apply = (acct, delta, type, amount, description, counterparty, at) => {
      acct.balance += delta;
      if (acct.balance < 0) throw new Error(`Seed data overdraws ${acct.owner.key}.${acct.type}`);
      insertTx.run(acct.id, type, amount, acct.balance, description, counterparty, at);
    };

    ACTIVITY.forEach((e, i) => {
      const at = timestamp(e.daysAgo, i);
      if (e.type === 'deposit') apply(accounts[e.at], e.amount, 'deposit', e.amount, e.description, null, at);
      else if (e.type === 'withdrawal')
        apply(accounts[e.at], -e.amount, 'withdrawal', e.amount, e.description, null, at);
      else {
        const from = accounts[e.from];
        const to = accounts[e.to];
        const internal = from.owner === to.owner;
        // Counterparty labels match what the live transfer code in accountRepository.js writes.
        const outLabel = internal ? `Your ${to.type} ${mask(to.number)}` : `${to.owner.name} ${mask(to.number)}`;
        const inLabel = internal ? `Your ${from.type} ${mask(from.number)}` : from.owner.name;
        apply(from, -e.amount, 'transfer_out', e.amount, e.description, outLabel, at);
        apply(to, e.amount, 'transfer_in', e.amount, e.description, inLabel, at);
      }
    });

    for (const acct of Object.values(accounts)) setBalance.run(acct.balance, acct.id);
  });

  return true;
}
