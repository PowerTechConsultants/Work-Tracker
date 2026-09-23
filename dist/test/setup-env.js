"use strict";
// Runs in each test worker BEFORE test file imports.
// Forces the app to use the isolated hr_test database (never the dev DB).
// NOTE: DATABASE_URL overrides individual MYSQL_* vars in db/index.ts, and
// dotenv.config() inside db/index.ts would restore a deleted var from
// server/.env — so set it to empty string (dotenv never overwrites existing
// vars, and empty is falsy for the `if (url)` check).
process.env.DATABASE_URL = '';
process.env.MYSQL_DATABASE = process.env.TEST_MYSQL_DATABASE || 'hr_test';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
