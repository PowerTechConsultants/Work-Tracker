import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { startTestServer, stopTestServer } from './helpers';

let baseURL: string;
let adminToken: string;
let employeeToken: string;
let employeeUser: any;

beforeAll(async () => {
  baseURL = await startTestServer();

  const adminLogin = await request(baseURL)
    .post('/api/v1/auth/login')
    .send({ email: 'admin@example.com', password: 'Admin@123' });
  adminToken = adminLogin.body.accessToken;

  const empLogin = await request(baseURL)
    .post('/api/v1/auth/login')
    .send({ email: 'john@example.com', password: 'John@12345' });
  employeeToken = empLogin.body.accessToken;
  employeeUser = empLogin.body.user;
});

afterAll(async () => {
  await stopTestServer();
});

describe('Users Module', () => {
  describe('GET /api/v1/users', () => {
    it('should list users for admin', async () => {
      const res = await request(baseURL)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('users');
      expect(Array.isArray(res.body.users)).toBe(true);
      expect(res.body.users.length).toBeGreaterThan(0);
    });

    it('should reject employee from listing users', async () => {
      const res = await request(baseURL)
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/users/stats', () => {
    it('should return user stats for admin', async () => {
      const res = await request(baseURL)
        .get('/api/v1/users/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });
  });
});

describe('Departments Module', () => {
  describe('GET /api/v1/departments', () => {
    it('should list departments', async () => {
      const res = await request(baseURL)
        .get('/api/v1/departments')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body) || res.body.departments).toBeDefined();
    });
  });

  describe('POST /api/v1/departments', () => {
    it('should create department as admin', async () => {
      const res = await request(baseURL)
        .post('/api/v1/departments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Test Department', description: 'Test dept' });

      expect(res.status).toBe(201);
    });

    it('should reject duplicate department name', async () => {
      const res = await request(baseURL)
        .post('/api/v1/departments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Test Department', description: 'Duplicate' });

      expect(res.status).toBe(409);
    });

    it('should reject employee from creating department', async () => {
      const res = await request(baseURL)
        .post('/api/v1/departments')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ name: 'Employee Dept', description: 'Should fail' });

      expect(res.status).toBe(403);
    });
  });
});

describe('Tasks Module', () => {
  let taskId: string;

  describe('POST /api/v1/tasks', () => {
    it('should create task as admin', async () => {
      const res = await request(baseURL)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Test Task', priority: 'high', description: 'Test description', assigneeIds: [employeeUser.id] });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      taskId = res.body.id;
    });

    it('should reject employee from creating task', async () => {
      const res = await request(baseURL)
        .post('/api/v1/tasks')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ title: 'Employee Task', priority: 'low' });

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/tasks', () => {
    it('should list tasks for admin', async () => {
      const res = await request(baseURL)
        .get('/api/v1/tasks')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/v1/tasks/stats', () => {
    it('should return task statistics', async () => {
      const res = await request(baseURL)
        .get('/api/v1/tasks/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });
  });
});

describe('Plans Module', () => {
  describe('POST /api/v1/plans', () => {
    it('should create work plan', async () => {
      const res = await request(baseURL)
        .post('/api/v1/plans')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ plannedWork: 'Fix bugs', priority: 'high', estimatedHours: 4, date: new Date().toISOString() });

      expect(res.status).toBe(201);
    });
  });

  describe('GET /api/v1/plans', () => {
    it('should list plans', async () => {
      const res = await request(baseURL)
        .get('/api/v1/plans')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(200);
    });
  });
});

describe('Leaves Module', () => {
  describe('GET /api/v1/leaves/balance', () => {
    it('should return leave balance', async () => {
      const res = await request(baseURL)
        .get('/api/v1/leaves/balance')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(200);
      // Leave balance uses a flat 28-day annual allowance (no carryover).
      expect(res.body.totalBalance).toBe(28);
      expect(res.body.totalAvailable).toBe(28);
      expect(res.body.totalRemaining).toBe(28);
      expect(res.body.extraUsed).toBe(0);
      expect(res.body.carryover).toBe(0);
      expect(res.body.totalBreakdown).toEqual({ used: 0, extraUsed: 0 });
    });
  });

  describe('POST /api/v1/leaves', () => {
    it('should apply for leave', async () => {
      const res = await request(baseURL)
        .post('/api/v1/leaves')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          type: 'sick',
          startDate: '2026-09-01T00:00:00.000Z',
          endDate: '2026-09-01T00:00:00.000Z',
          reason: 'Medical appointment',
        });

      expect(res.status).toBe(201);
    });

    it('should reject leave with end date before start date', async () => {
      const res = await request(baseURL)
        .post('/api/v1/leaves')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({
          type: 'casual',
          startDate: '2026-09-10',
          endDate: '2026-09-05',
          reason: 'Invalid dates',
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/leaves', () => {
    it('should list leaves', async () => {
      const res = await request(baseURL)
        .get('/api/v1/leaves')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(200);
    });
  });
});

describe('Notifications Module', () => {
  describe('GET /api/v1/notifications', () => {
    it('should list notifications', async () => {
      const res = await request(baseURL)
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('unreadCount');
    });
  });
});

describe('Holidays Module', () => {
  describe('GET /api/v1/holidays', () => {
    it('should list holidays', async () => {
      const res = await request(baseURL)
        .get('/api/v1/holidays')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });
  });
});

describe('System Module', () => {
  describe('GET /api/v1/system/db', () => {
    it('should return DB overview for admin', async () => {
      const res = await request(baseURL)
        .get('/api/v1/system/db')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });

    it('should reject employee from DB overview', async () => {
      const res = await request(baseURL)
        .get('/api/v1/system/db')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/v1/system/backups', () => {
    it('should list backups for admin', async () => {
      const res = await request(baseURL)
        .get('/api/v1/system/backups')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.backups)).toBe(true);
    });
  });
});
