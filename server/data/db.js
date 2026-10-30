import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT    NOT NULL,
    email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT    NOT NULL,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT    PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT    NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS accounts (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type          TEXT    NOT NULL CHECK (type IN ('checking', 'savings')),
    number        TEXT    NOT NULL UNIQUE,
    balance_cents INTEGER NOT NULL DEFAULT 0 CHECK (balance_cents >= 0),
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS transactions (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id          INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    type                TEXT    NOT NULL
                        CHECK (type IN ('deposit', 'withdrawal', 'transfer_in', 'transfer_out')),
    amount_cents        INTEGER NOT NULL CHECK (amount_cents > 0),
    balance_after_cents INTEGER NOT NULL,
    description         TEXT    NOT NULL DEFAULT '',
    counterparty        TEXT,
    created_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  );

  CREATE INDEX IF NOT EXISTS idx_accounts_user ON accounts(user_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_id, id DESC);
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
`;

/**
 * Opens (or creates) the SQLite database and applies the schema.
 * Pass ':memory:' for an ephemeral database (used by tests).
 */
export function createDatabase(filename = ':memory:') {
  if (filename !== ':memory:') mkdirSync(dirname(filename), { recursive: true });

  const db = new DatabaseSync(filename);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  db.exec(SCHEMA);
  return db;
}

/**
 * Runs `fn` inside a write transaction, rolling back if it throws.
 */
export function inTransaction(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
