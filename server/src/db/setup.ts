import dotenv from 'dotenv';
dotenv.config();
import { ensureAdminBootstrap } from './bootstrap';

async function setup() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail) {
    console.error('[SETUP] Missing required environment variable: ADMIN_EMAIL');
    process.exit(1);
  }
  if (!adminPassword) {
    console.error('[SETUP] Missing required environment variable: ADMIN_PASSWORD');
    process.exit(1);
  }

  if (adminPassword.length < 12) {
    console.error('[SETUP] ADMIN_PASSWORD must be at least 12 characters');
    process.exit(1);
  }

  await ensureAdminBootstrap();
}

setup();
