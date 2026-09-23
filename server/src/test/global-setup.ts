import dotenv from 'dotenv';
dotenv.config();
import fs from 'fs';
import path from 'path';

// Runs once before all test files (separate process).
// Deletes any stale hr_test SQLite file so every run starts from a clean,
// isolated database (never the dev data.db).
export default async function globalSetup() {
  const testDb = path.join(process.cwd(), 'hr_test.db');
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    try {
      if (fs.existsSync(testDb + suffix)) fs.unlinkSync(testDb + suffix);
    } catch {}
  }
  console.log(`[TestSetup] Database ready: ${testDb}`);
}
