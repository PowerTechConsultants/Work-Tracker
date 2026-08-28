import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { startTestServer, stopTestServer } from './helpers';

let baseURL: string;
let adminToken: string;
let employeeToken: string;

function refreshCookie(res: any): string {
  const sc = res.headers['set-cookie'];
  const c = Array.isArray(sc) ? sc[0] : sc;
  return c.split(';')[0];
}

beforeAll(async () => {
  baseURL = await startTestServer();
});

afterAll(async () => {
  await stopTestServer();
});

describe('Auth Module', () => {
  describe('POST /api/v1/auth/login', () => {
    it('should login with valid admin credentials', async () => {
      const res = await request(baseURL)
        .post('/api/v1/auth/login')
        .send({ email: 'admin@example.com', password: 'Admin@123' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body.user).toBeDefined();
      expect(res.headers['set-cookie']).toBeDefined();
      expect(res.body.user.email).toBe('admin@example.com');
      expect(res.body.user.role).toBe('director');
      adminToken = res.body.accessToken;
    });

    it('should login with valid employee credentials', async () => {
      const res = await request(baseURL)
        .post('/api/v1/auth/login')
        .send({ email: 'john@example.com', password: 'John@12345' });

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
      expect(res.body.user.role).toBe('employee');
      employeeToken = res.body.accessToken;
    });

    it('should reject invalid password', async () => {
      const res = await request(baseURL)
        .post('/api/v1/auth/login')
        .send({ email: 'admin@example.com', password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid credentials');
    });

    it('should reject non-existent email', async () => {
      const res = await request(baseURL)
        .post('/api/v1/auth/login')
        .send({ email: 'nonexistent@example.com', password: 'password' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid credentials');
    });

    it('should reject missing fields', async () => {
      const res = await request(baseURL)
        .post('/api/v1/auth/login')
        .send({ email: 'admin@example.com' });

      expect(res.status).toBe(400);
    });

    it('should reject empty body', async () => {
      const res = await request(baseURL)
        .post('/api/v1/auth/login')
        .send({});

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return user profile with valid token', async () => {
      const res = await request(baseURL)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.email).toBe('admin@example.com');
      expect(res.body.role).toBe('director');
      expect(res.body).toHaveProperty('id');
      expect(res.body).toHaveProperty('employeeId');
      expect(res.body).toHaveProperty('firstName');
      expect(res.body).toHaveProperty('lastName');
    });

    it('should return 401 without token', async () => {
      const res = await request(baseURL)
        .get('/api/v1/auth/me');

      expect(res.status).toBe(401);
    });

    it('should return 401 with invalid token', async () => {
      const res = await request(baseURL)
        .get('/api/v1/auth/me')
        .set('Authorization', 'Bearer invalidtoken123');

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('should refresh tokens with valid refresh token', async () => {
      const loginRes = await request(baseURL)
        .post('/api/v1/auth/login')
        .send({ email: 'admin@example.com', password: 'Admin@123' });

      const res = await request(baseURL)
        .post('/api/v1/auth/refresh')
        .set('Cookie', refreshCookie(loginRes));

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('accessToken');
    });

    it('should reject invalid refresh token', async () => {
      const res = await request(baseURL)
        .post('/api/v1/auth/refresh')
        .set('Cookie', 'refreshToken=invalidtoken');

      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('should logout successfully', async () => {
      const loginRes = await request(baseURL)
        .post('/api/v1/auth/login')
        .send({ email: 'john@example.com', password: 'John@12345' });

      const refreshToken = loginRes.body.refreshToken;

      const res = await request(baseURL)
        .post('/api/v1/auth/logout')
        .send({ refreshToken });

      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/v1/auth/forgot-password', () => {
    it('should always return success message (even for non-existent email)', async () => {
      const res = await request(baseURL)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'nonexistent@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('reset token');
    });

    it('should return success for existing email', async () => {
      const res = await request(baseURL)
        .post('/api/v1/auth/forgot-password')
        .send({ email: 'admin@example.com' });

      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/v1/auth/change-password', () => {
    it('should change password with valid current password', async () => {
      const res = await request(baseURL)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${employeeToken}`)
        .send({ currentPassword: 'John@12345', newPassword: 'NewPass123!' });

      expect(res.status).toBe(200);
    });

    it('should reject wrong current password', async () => {
      const loginRes = await request(baseURL)
        .post('/api/v1/auth/login')
        .send({ email: 'jane@example.com', password: 'Jane@12345' });

      const res = await request(baseURL)
        .post('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${loginRes.body.accessToken}`)
        .send({ currentPassword: 'WrongPassword1!', newPassword: 'NewPass123!' });

      expect(res.status).toBe(400);
    });
  });
});
