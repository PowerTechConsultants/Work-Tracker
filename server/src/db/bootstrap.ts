import bcrypt from 'bcrypt';
import db, { uuid } from './index';

export function ensureAdminBootstrap() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as any).count;
  if (userCount > 0) {
    return;
  }

  if (!adminEmail || !adminPassword) {
    console.warn('[SETUP] No users found and ADMIN_EMAIL/ADMIN_PASSWORD not set. Set them to auto-create the initial admin on first run.');
    return;
  }

  if (adminPassword.length < 12) {
    console.warn('[SETUP] ADMIN_PASSWORD must be at least 12 characters. Skipping admin creation.');
    return;
  }

  console.log('[SETUP] Creating initial admin account...');

  db.transaction(() => {
    const deptId = uuid();
    db.prepare('INSERT OR IGNORE INTO departments (id, name, description) VALUES (?, ?, ?)').run(deptId, 'Engineering', 'Software engineering team');

    const passwordHash = bcrypt.hashSync(adminPassword, 12);
    db.prepare(`INSERT INTO users (id, employee_id, first_name, last_name, email, password_hash, role, designation, department_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run(uuid(), 'EMP-0001', 'Admin', 'User', adminEmail, passwordHash, 'director', 'System Administrator', deptId);
  })();

  console.log('[SETUP] Admin account created successfully');
  console.log(`[SETUP] Email: ${adminEmail}`);
  console.log('[SETUP] You can now log in and create additional users from the dashboard');
}
