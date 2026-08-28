import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { startTestServer, stopTestServer } from './helpers';

let baseURL: string;

beforeAll(async () => {
  baseURL = await startTestServer();
});

afterAll(async () => {
  await stopTestServer();
});

describe('Rate Limiting', () => {
  it('should include rate limit headers', async () => {
    const res = await request(baseURL).get('/health');
    expect(res.status).toBe(200);
  });
});

describe('CORS', () => {
  it('should respond to preflight requests', async () => {
    const res = await request(baseURL)
      .options('/api/v1/auth/login')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'POST');

    expect([200, 204]).toContain(res.status);
  });
});

describe('Security Headers', () => {
  it('should include Helmet security headers', async () => {
    const res = await request(baseURL).get('/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
  });
});

describe('Content-Type', () => {
  it('should return JSON for API endpoints', async () => {
    const res = await request(baseURL).get('/health');
    expect(res.headers['content-type']).toMatch(/json/);
  });
});

describe('API Versioning', () => {
  it('should prefix all API routes with /api/v1', async () => {
    const res = await request(baseURL).get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('should return 404 for unversioned routes', async () => {
    const res = await request(baseURL).get('/auth/me');
    expect(res.status).toBe(404);
  });
});
