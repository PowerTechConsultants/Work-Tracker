import dotenv from 'dotenv';
dotenv.config();
// Neutralize DATABASE_URL first: db/index.ts prefers it over MYSQL_*,
// and local server/.env points it at the dev database.
// Empty string (not delete): db/index.ts calls dotenv.config() on import,
// which would restore a deleted var from server/.env.
process.env.DATABASE_URL = '';
process.env.MYSQL_DATABASE = 'hr_test';
const dbModule = await import('../db/index.js');
const db = dbModule.default;
const pool = dbModule.pool;
import bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
// Seeds a known director for Playwright E2E runs (hr_test only).
// Usage: npx tsx src/test/e2e-seed.ts
// Safe by design: refuses to run against any other database.
const usingRows = (await db.prepare('SELECT DATABASE() AS db').get());
const usingDb = usingRows?.db;
if (usingDb !== 'hr_test') {
    console.error(`[E2ESeed] Refusing to seed non-test database: "${usingDb}".`);
    process.exit(1);
}
const EMAIL = 'e2e-director@example.com';
const PASSWORD = 'E2ePassword123!';
const existing = (await db.prepare('SELECT id FROM users WHERE email = ?').get(EMAIL));
if (!existing) {
    const hash = await bcrypt.hash(PASSWORD, 4);
    await db.prepare('INSERT INTO users (id, employee_id, first_name, last_name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(randomUUID(), 'E2E-0001', 'E2E', 'Director', EMAIL, hash, 'director', 'active');
    console.log('[E2ESeed] Director seeded:', EMAIL);
}
else {
    console.log('[E2ESeed] Director already exists:', EMAIL);
}
await pool.end();
process.exit(0);
