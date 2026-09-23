// Runs in each test worker BEFORE test file imports.
// Forces the app to use an isolated hr_test SQLite file (never the dev DB).
// The file lives next to the dev DB (server/) so rebuilds never touch it.
import path from 'path';
process.env.SQLITE_PATH = path.join(process.cwd(), 'hr_test.db');
process.env.DATABASE_URL = '';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
