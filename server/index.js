import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createDatabase } from './data/db.js';
import { seedDemoData, DEMO_USERS, DEMO_PASSWORD } from './data/seed.js';
import { createApp } from './app.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const isProd = process.env.NODE_ENV === 'production';
const PORT = Number(process.env.PORT) || 3001;
const DB_FILE = process.env.DB_FILE || join(root, 'data', 'bank.db');

const db = createDatabase(DB_FILE);

// Demo users are seeded into an empty database by default outside production.
// Override with SEED_DEMO_DATA=true|false.
const seedDemo = process.env.SEED_DEMO_DATA ? process.env.SEED_DEMO_DATA === 'true' : !isProd;
if (seedDemo && (await seedDemoData(db))) {
  console.log(`Seeded demo users (${DEMO_USERS.map((u) => u.email).join(', ')}) with password "${DEMO_PASSWORD}"`);
}

const app = createApp({
  db,
  staticDir: isProd ? join(root, 'dist') : undefined,
  // Set SECURE_COOKIES=false only when running the production build over plain HTTP locally.
  secureCookies: isProd && process.env.SECURE_COOKIES !== 'false',
});

const purge = setInterval(() => app.locals.sessions.purgeExpired(), 60 * 60 * 1000);
purge.unref();

const server = app.listen(PORT, () => {
  console.log(`Bank API listening on http://localhost:${PORT}`);
});

const shutdown = () => {
  server.close(() => {
    db.close();
    process.exit(0);
  });
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
