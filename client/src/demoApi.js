// Browser-only stand-in for the Express API, used when the site is built with VITE_DEMO_MODE=true
// (e.g. for GitHub Pages, which can only host static files). It has the same methods and response
// shapes as the HTTP client in api.js, but stores everything in this browser's localStorage.
// This is for demos only: nothing is private or shared between visitors.
import { AppError, badRequest, conflict, notFound, unauthorized, unprocessable } from '../../server/errors.js';
import {
  validateRegistration,
  parseAmount,
  parseDescription,
  parseId,
  parseAccountNumber,
} from '../../server/validation.js';
import { DEMO_PASSWORD, DEMO_USERS, ACTIVITY } from '../../server/data/demoData.js';
import { createMarket } from '../../server/services/market.js';

const DB_KEY = 'nova-bank-demo:db:v1';
const SESSION_KEY = 'nova-bank-demo:session:v1';
const SESSION_TTL_MS = 1000 * 60 * 60 * 8;
const TRANSACTION_LIMIT = 50;

const mask = (number) => `••${number.slice(-4)}`;
const nowIso = () => new Date().toISOString();

// --- Password hashing (PBKDF2 via Web Crypto, so plain-text passwords are never stored) ---

const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

async function hashPassword(password, salt = toHex(crypto.getRandomValues(new Uint8Array(16)))) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveBits',
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 100_000 },
    key,
    256
  );
  return `${salt}:${toHex(bits)}`;
}

async function verifyPassword(password, stored) {
  const [salt] = stored.split(':');
  return (await hashPassword(password, salt)) === stored;
}

// --- Storage ---

function load() {
  try {
    const db = JSON.parse(localStorage.getItem(DB_KEY));
    if (db?.users && db.accounts && db.transactions) return db;
  } catch {
    // Corrupt or missing data falls through to a fresh database.
  }
  return null;
}

const save = (db) => localStorage.setItem(DB_KEY, JSON.stringify(db));

const nextId = (db, table) => {
  db.nextIds[table] = (db.nextIds[table] ?? 0) + 1;
  return db.nextIds[table];
};

/** Builds the same demo users, accounts and history as server/data/seed.js. */
async function seed() {
  const db = { users: [], accounts: [], transactions: [], nextIds: {} };
  const passwordHash = await hashPassword(DEMO_PASSWORD);
  const now = Date.now();
  const timestamp = (daysAgo, i) => new Date(now - daysAgo * 86_400_000 + i * 60_000).toISOString();
  const created = timestamp(60, 0);

  const byKey = {};
  for (const u of DEMO_USERS) {
    const user = { id: nextId(db, 'users'), name: u.name, email: u.email, passwordHash, createdAt: created };
    db.users.push(user);
    for (const [type, number] of Object.entries(u.accounts)) {
      const account = { id: nextId(db, 'accounts'), userId: user.id, type, number, balanceCents: 0, createdAt: created };
      db.accounts.push(account);
      byKey[`${u.key}.${type}`] = { account, owner: user };
    }
  }

  const apply = ({ account }, delta, type, amountCents, description, counterparty, createdAt) => {
    account.balanceCents += delta;
    db.transactions.push({
      id: nextId(db, 'transactions'),
      accountId: account.id,
      type,
      amountCents,
      balanceAfterCents: account.balanceCents,
      description,
      counterparty,
      createdAt,
    });
  };

  ACTIVITY.forEach((e, i) => {
    const at = timestamp(e.daysAgo, i);
    if (e.type === 'deposit') apply(byKey[e.at], e.amount, 'deposit', e.amount, e.description, null, at);
    else if (e.type === 'withdrawal') apply(byKey[e.at], -e.amount, 'withdrawal', e.amount, e.description, null, at);
    else {
      const from = byKey[e.from];
      const to = byKey[e.to];
      const internal = from.owner === to.owner;
      const outLabel = internal
        ? `Your ${to.account.type} ${mask(to.account.number)}`
        : `${to.owner.name} ${mask(to.account.number)}`;
      const inLabel = internal ? `Your ${from.account.type} ${mask(from.account.number)}` : from.owner.name;
      apply(from, -e.amount, 'transfer_out', e.amount, e.description, outLabel, at);
      apply(to, e.amount, 'transfer_in', e.amount, e.description, inLabel, at);
    }
  });

  save(db);
  return db;
}

let dbPromise;
const getDb = () => (dbPromise ??= Promise.resolve(load() ?? seed()));

// --- Sessions ---

function currentUserId() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (session && session.expiresAt > Date.now()) return session.userId;
  } catch {
    // Ignore malformed session data.
  }
  localStorage.removeItem(SESSION_KEY);
  return null;
}

const startSession = (userId) =>
  localStorage.setItem(SESSION_KEY, JSON.stringify({ userId, expiresAt: Date.now() + SESSION_TTL_MS }));

// --- Shapes (match the server's JSON responses) ---

const toUser = (u) => ({ id: u.id, name: u.name, email: u.email, createdAt: u.createdAt });
const toAccount = (a) => ({ id: a.id, type: a.type, number: a.number, balanceCents: a.balanceCents, createdAt: a.createdAt });

function requireUser(db) {
  const id = currentUserId();
  const user = id && db.users.find((u) => u.id === id);
  if (!user) throw unauthorized();
  return user;
}

function ownedAccount(db, accountId, userId) {
  const account = db.accounts.find((a) => a.id === accountId);
  if (!account || account.userId !== userId) throw notFound('Account not found');
  return account;
}

function generateNumber(db) {
  for (;;) {
    const number = String(1_000_000_000 + Math.floor(Math.random() * 9_000_000_000));
    if (!db.accounts.some((a) => a.number === number)) return number;
  }
}

function post(db, account, delta, type, amountCents, description, counterparty = null) {
  if (delta < 0 && account.balanceCents < amountCents) throw unprocessable('Insufficient funds');
  account.balanceCents += delta;
  db.transactions.push({
    id: nextId(db, 'transactions'),
    accountId: account.id,
    type,
    amountCents,
    balanceAfterCents: account.balanceCents,
    description,
    counterparty,
    createdAt: nowIso(),
  });
}

/**
 * Runs an operation against a working copy of the database and only saves if it succeeds,
 * so a failed transfer can't leave half-applied changes (like the server's DB transactions).
 */
async function mutate(fn) {
  const db = await getDb();
  const draft = structuredClone(db);
  const result = await fn(draft);
  Object.assign(db, draft);
  save(db);
  return result;
}

// --- Error handling (same messages and 401 behaviour as the HTTP client) ---

let onUnauthorized = () => {};

async function call(name, fn) {
  try {
    return await fn();
  } catch (e) {
    if (!(e instanceof AppError)) throw e;
    if (e.status === 401 && !name.startsWith('auth.')) onUnauthorized();
    const err = new Error(e.details?.join(', ') || e.message);
    err.status = e.status;
    throw err;
  }
}

export function createDemoApi() {
  const market = createMarket();
  return {
    setUnauthorizedHandler(fn) {
      onUnauthorized = fn;
    },

    api: {
      me: () =>
        call('auth.me', async () => {
          const db = await getDb();
          const id = currentUserId();
          const user = id && db.users.find((u) => u.id === id);
          return { user: user ? toUser(user) : null };
        }),

      login: (email, password) =>
        call('auth.login', async () => {
          const normalized = typeof email === 'string' ? email.trim().toLowerCase() : '';
          if (!normalized || !password) throw badRequest('Email and password are required');
          const db = await getDb();
          const user = db.users.find((u) => u.email === normalized);
          if (!user || !(await verifyPassword(password, user.passwordHash))) {
            throw unauthorized('Invalid email or password');
          }
          startSession(user.id);
          return { user: toUser(user) };
        }),

      register: (name, email, password) =>
        call('auth.register', async () => {
          const input = validateRegistration({ name, email, password });
          if (input.errors.length) throw badRequest('Validation failed', input.errors);
          const passwordHash = await hashPassword(input.password);
          const user = await mutate((db) => {
            if (db.users.some((u) => u.email === input.email)) {
              throw conflict('An account with this email already exists');
            }
            const created = { id: nextId(db, 'users'), name: input.name, email: input.email, passwordHash, createdAt: nowIso() };
            db.users.push(created);
            for (const type of ['checking', 'savings']) {
              db.accounts.push({
                id: nextId(db, 'accounts'),
                userId: created.id,
                type,
                number: generateNumber(db),
                balanceCents: 0,
                createdAt: nowIso(),
              });
            }
            return created;
          });
          startSession(user.id);
          return { user: toUser(user) };
        }),

      logout: () =>
        call('auth.logout', async () => {
          localStorage.removeItem(SESSION_KEY);
          return null;
        }),

      popularStocks: () => call('market', async () => market.snapshot()),

      accounts: () =>
        call('accounts', async () => {
          const db = await getDb();
          const user = requireUser(db);
          const accounts = db.accounts.filter((a) => a.userId === user.id);
          const ids = new Set(accounts.map((a) => a.id));
          const d = new Date();
          const monthStart = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
          let monthInCents = 0;
          let monthOutCents = 0;
          for (const t of db.transactions) {
            // Internal transfers between the user's own accounts are excluded, as on the server.
            if (!ids.has(t.accountId) || t.createdAt < monthStart || t.counterparty?.startsWith('Your ')) continue;
            if (t.type === 'deposit' || t.type === 'transfer_in') monthInCents += t.amountCents;
            else monthOutCents += t.amountCents;
          }
          return {
            accounts: accounts.map(toAccount),
            summary: {
              totalCents: accounts.reduce((sum, a) => sum + a.balanceCents, 0),
              monthInCents,
              monthOutCents,
            },
          };
        }),

      transactions: (accountId) =>
        call('transactions', async () => {
          const db = await getDb();
          const user = requireUser(db);
          const filterId = accountId ? parseId(accountId, 'accountId') : undefined;
          const owned = new Map(db.accounts.filter((a) => a.userId === user.id).map((a) => [a.id, a]));
          return db.transactions
            .filter((t) => owned.has(t.accountId) && (!filterId || t.accountId === filterId))
            .sort((a, b) => b.id - a.id)
            .slice(0, TRANSACTION_LIMIT)
            .map((t) => {
              const a = owned.get(t.accountId);
              return { ...t, accountType: a.type, accountNumber: a.number };
            });
        }),

      deposit: (accountId, amount, description) =>
        call('deposit', async () => {
          const cents = parseAmount(amount);
          const memo = parseDescription(description, 'Deposit');
          return mutate((db) => {
            const account = ownedAccount(db, parseId(accountId), requireUser(db).id);
            post(db, account, cents, 'deposit', cents, memo);
            return toAccount(account);
          });
        }),

      withdraw: (accountId, amount, description) =>
        call('withdraw', async () => {
          const cents = parseAmount(amount);
          const memo = parseDescription(description, 'Withdrawal');
          return mutate((db) => {
            const account = ownedAccount(db, parseId(accountId), requireUser(db).id);
            post(db, account, -cents, 'withdrawal', cents, memo);
            return toAccount(account);
          });
        }),

      transfer: (fromAccountId, toAccountNumber, amount, description) =>
        call('transfer', async () => {
          const fromId = parseId(fromAccountId, 'fromAccountId');
          const number = parseAccountNumber(toAccountNumber);
          const cents = parseAmount(amount);
          const memo = parseDescription(description, 'Transfer');
          return mutate((db) => {
            const user = requireUser(db);
            const from = ownedAccount(db, fromId, user.id);
            const to = db.accounts.find((a) => a.number === number);
            if (!to) throw notFound('Destination account not found');
            if (to.id === from.id) throw badRequest('Cannot transfer to the same account');

            const internal = to.userId === user.id;
            const recipient = db.users.find((u) => u.id === to.userId);
            const outLabel = internal ? `Your ${to.type} ${mask(to.number)}` : `${recipient.name} ${mask(to.number)}`;
            const inLabel = internal ? `Your ${from.type} ${mask(from.number)}` : user.name;

            post(db, from, -cents, 'transfer_out', cents, memo, outLabel);
            post(db, to, cents, 'transfer_in', cents, memo, inLabel);
            return toAccount(from);
          });
        }),
    },
  };
}
