import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { startTestServer, stopTestServer, getBaseURL } from './helpers';

let baseURL: string;

beforeAll(async () => {
  baseURL = await startTestServer();
});

afterAll(async () => {
  await stopTestServer();
});

describe('Health Endpoints', () => {
  it('GET /health should return 200 with status ok', async () => {
    const res = await request(baseURL).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('uptime');
    expect(res.body).toHaveProperty('environment');
    expect(res.body).toHaveProperty('version');
    expect(res.body).toHaveProperty('dbMigrationVersion');
  });

  it('GET /ready should return 200 with ready status', async () => {
    const res = await request(baseURL).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
    expect(res.body.checks.database).toBe('ok');
  });
});

describe('404 Handling', () => {
  it('GET /nonexistent should return 404', async () => {
    const res = await request(baseURL).get('/nonexistent');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Not found');
  });

  it('GET /api/v1/nonexistent should return 404', async () => {
    const res = await request(baseURL).get('/api/v1/nonexistent');
    expect(res.status).toBe(404);
  });
});
