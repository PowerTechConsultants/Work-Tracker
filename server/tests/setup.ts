// Test bootstrap: runs in each vitest worker before the app modules are loaded.
// The server is pointed at a fresh in-memory database via `test.env` in
// vitest.config.ts; this file seeds the users the test suites expect
// (admin director + two employees). Each test file gets its own isolated
// database, so cross-file state (password changes, created records, duplicate
// checks) cannot bleed into other suites.
import bcrypt from 'bcrypt';
import db, { uuid } from '../src/db';

const SALT_ROUNDS = 12;

function seedUser(input: {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: string;
  employeeId: string;
  designation: string;
  departmentId: string;
}) {
  const passwordHash = bcrypt.hashSync(input.password, SALT_ROUNDS);
  db.prepare(
    `INSERT OR IGNORE INTO users
       (id, employee_id, first_name, last_name, email, password_hash, role, designation, department_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    uuid(),
    input.employeeId,
    input.firstName,
    input.lastName,
    input.email,
    passwordHash,
    input.role,
    input.designation,
    input.departmentId
  );
}

const engDeptId = uuid();
db.prepare(
  'INSERT OR IGNORE INTO departments (id, name, description) VALUES (?, ?, ?)'
).run(engDeptId, 'Engineering', 'Software engineering team');

seedUser({
  email: 'admin@example.com',
  password: 'Admin@123',
  firstName: 'Admin',
  lastName: 'User',
  role: 'director',
  employeeId: 'EMP-0001',
  designation: 'System Administrator',
  departmentId: engDeptId,
});

seedUser({
  email: 'john@example.com',
  password: 'John@12345',
  firstName: 'John',
  lastName: 'Doe',
  role: 'employee',
  employeeId: 'EMP-0002',
  designation: 'Software Engineer',
  departmentId: engDeptId,
});

seedUser({
  email: 'jane@example.com',
  password: 'Jane@12345',
  firstName: 'Jane',
  lastName: 'Smith',
  role: 'employee',
  employeeId: 'EMP-0003',
  designation: 'QA Engineer',
  departmentId: engDeptId,
});
