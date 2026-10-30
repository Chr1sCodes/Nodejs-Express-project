import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createDatabase } from './data/db.js';
import { seedDemoData, DEMO_USERS, DEMO_PASSWORD } from './data/seed.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const DB_FILE = process.env.DB_FILE || join(root, 'data', 'bank.db');

const db = createDatabase(DB_FILE);
const seeded = await seedDemoData(db);
db.close();

if (seeded) {
  console.log(`Seeded demo data into ${DB_FILE}. Sign in with any of these (password: ${DEMO_PASSWORD}):`);
  for (const u of DEMO_USERS) console.log(`  ${u.email}`);
} else {
  console.log(`${DB_FILE} already has users; nothing seeded. Delete the file to reseed.`);
}
