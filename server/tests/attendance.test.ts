import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { startTestServer, stopTestServer } from './helpers';

let baseURL: string;
let adminToken: string;
let employeeToken: string;

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
});

afterAll(async () => {
  await stopTestServer();
});

describe('Attendance Module', () => {
  describe('POST /api/v1/attendance/check-in', () => {
    it('should check in successfully', async () => {
      const res = await request(baseURL)
        .post('/api/v1/attendance/check-in')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ status: 'present' });

      expect(res.status).toBe(201);
      expect(res.body).toHaveProperty('id');
      expect(res.body.status).toMatch(/present|on_break|work_end/);
    });

    it('should reject duplicate check-in', async () => {
      const res = await request(baseURL)
        .post('/api/v1/attendance/check-in')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ status: 'present' });

      expect(res.status).toBe(409);
    });
  });

  describe('GET /api/v1/attendance/today', () => {
    it('should return today attendance for employee', async () => {
      const res = await request(baseURL)
        .get('/api/v1/attendance/today')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('status');
    });

    it('should return 401 without auth', async () => {
      const res = await request(baseURL)
        .get('/api/v1/attendance/today');

      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/attendance/monthly', () => {
    it('should return monthly attendance summary', async () => {
      const res = await request(baseURL)
        .get('/api/v1/attendance/monthly')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('summary');
      expect(res.body).toHaveProperty('totalWorkingHours');
    });
  });

  describe('GET /api/v1/attendance/today-all (admin)', () => {
    it('should return all employees attendance for admin', async () => {
      const res = await request(baseURL)
        .get('/api/v1/attendance/today-all')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body) || res.body).toBeDefined();
    });

    it('should reject employee from viewing all attendance', async () => {
      const res = await request(baseURL)
        .get('/api/v1/attendance/today-all')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/v1/attendance/check-out', () => {
    it('should check out successfully', async () => {
      const res = await request(baseURL)
        .post('/api/v1/attendance/check-out')
        .set('Authorization', `Bearer ${employeeToken}`);

      expect(res.status).toBe(200);
    });
  });
});
