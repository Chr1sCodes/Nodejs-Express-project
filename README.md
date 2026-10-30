# Nova Bank — Single Page Banking App

A full-stack banking demo. The **React** single-page app talks to a **Node.js/Express** REST API, which uses a data layer to read and write a **SQLite** database.

> ⚠️ This is a learning/demo project, not a real bank. Don't use real personal or financial data.

## Features

- **Register & sign in.** Passwords are hashed with scrypt. Sessions use an HttpOnly, SameSite=Strict cookie, and the session token is stored hashed in the database. Login and registration are rate-limited.
- **Automatic accounts.** Every new user gets a checking and a savings account, each with a unique 10-digit account number.
- **Deposit, withdraw and transfer.** Transfers can go between your own accounts or to anyone's account number. Overdrafts are blocked.
- **Dashboard.** Shows total balance, money in/out this month (internal transfers excluded) and an account card for each account.
- **Transaction history.** Filter by account or direction and search; each entry shows the running balance.
- Dark/light theme, toast notifications, password strength meter, responsive and accessible layout.

## Tech stack

| Layer      | Tech                                                         |
| ---------- | ------------------------------------------------------------ |
| Client     | HTML, CSS (custom properties), JavaScript, React 19, Vite    |
| Server     | Node.js, Express 5                                           |
| Data layer | SQLite via the built-in `node:sqlite` module (no native build step) |

## Project structure

```
client/                     React SPA (Vite root)
  src/
    App.jsx                 Auth state; switches between AuthPage and Dashboard
    api.js                  Fetch wrapper for the REST API
    format.js               Currency/date formatting helpers
    components/
      AuthPage.jsx          Login + register forms
      Dashboard.jsx         Overview, accounts and activity
      AccountCard.jsx
      TransactionList.jsx
      MoneyModal.jsx        Deposit / withdraw / transfer dialog
      Header.jsx, Toasts.jsx
server/
  index.js                  Entry point
  app.js                    Express app factory (middleware, routes, static hosting)
  errors.js                 HTTP error helpers
  middleware/
    auth.js                 Session loading, requireAuth, JSON-only (CSRF) guard
    rateLimit.js            In-memory rate limiter
  services/password.js      scrypt hashing / verification
  routes/
    auth.js                 /api/auth/*
    accounts.js             /api/accounts, /api/transactions, /api/transfers
  data/                     Data layer — all SQL lives here
    db.js                   Connection, schema, transaction helper
    userRepository.js
    sessionRepository.js
    accountRepository.js    Balances + ledger, atomic money movement
test/api.test.js            API integration tests (node:test)
```

## Getting started

Requires **Node.js 22.5+**.

```bash
npm install
npm run dev        # API on :3001 + Vite dev server on :5173 (proxies /api)
```

Open http://localhost:5173 and create an account.

### Production

```bash
npm run build      # builds the client into dist/
npm start          # Express serves the API and dist/ on http://localhost:3001
```

In production, session cookies are marked `Secure`, so serve the app over HTTPS. To try the production build locally over plain HTTP, run `SECURE_COOKIES=false npm start`.

### Tests

```bash
npm test
```

### Configuration

| Variable         | Default        | Description                                        |
| ---------------- | -------------- | -------------------------------------------------- |
| `PORT`           | `3001`         | HTTP port for Express                              |
| `DB_FILE`        | `data/bank.db` | Path to the SQLite file                            |
| `SECURE_COOKIES` | `true` in prod | Set to `false` to allow cookies over plain HTTP    |

## REST API

All bodies are JSON. Amounts are sent in dollars (`"12.34"` or `12.34`, max 2 decimals, up to $1,000,000) and returned in integer cents (`balanceCents`, `amountCents`) to avoid floating-point errors.

| Method | Path                         | Auth | Description                                                       |
| ------ | ---------------------------- | ---- | ----------------------------------------------------------------- |
| POST   | `/api/auth/register`         |      | `{ name, email, password }`. Creates user + accounts, signs in    |
| POST   | `/api/auth/login`            |      | `{ email, password }`                                             |
| POST   | `/api/auth/logout`           |      | Ends the session                                                  |
| GET    | `/api/auth/me`               |      | `{ user }`, or `{ user: null }` when signed out                   |
| GET    | `/api/accounts`              | ✓    | `{ accounts, summary }`                                           |
| GET    | `/api/accounts/:id`          | ✓    | One of your accounts                                              |
| POST   | `/api/accounts/:id/deposit`  | ✓    | `{ amount, description? }`                                        |
| POST   | `/api/accounts/:id/withdraw` | ✓    | `{ amount, description? }` — 422 if insufficient funds            |
| POST   | `/api/transfers`             | ✓    | `{ fromAccountId, toAccountNumber, amount, description? }`        |
| GET    | `/api/transactions`          | ✓    | Query: `accountId?`, `limit?` (default 50, max 200)               |

Passwords must be 8–128 characters and include at least one letter and one number.

## Data layer

Routes only use the repository interfaces in `server/data/`. Each balance change and its ledger entry are written in a single `BEGIN IMMEDIATE … COMMIT` transaction, and a `CHECK (balance_cents >= 0)` constraint stops overdrafts at the database level as well. To move to PostgreSQL or another store, implement the same repository methods and wire them up in `server/app.js`.
