import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { app, createUser, loginAs, authHeader } from '../../test/helpers.js';
describe('PATCH /api/v1/users/:id privilege guard', () => {
    it('strips role and status when HR edits a user', async () => {
        const hr = await createUser({ role: 'hr', password: 'Password123!' });
        const victim = await createUser({ password: 'Password123!' });
        const { token } = await loginAs(hr.email, 'Password123!');
        const res = await request(app)
            .patch(`/api/v1/users/${victim.id}`)
            .set(authHeader(token))
            .send({ firstName: 'Changed', phoneNumber: '+919937112760', role: 'director', status: 'inactive' });
        expect(res.status).toBe(200);
        expect(res.body.firstName).toBe('Changed');
        // Privilege fields must be ignored for HR
        expect(res.body.role).toBe('employee');
        expect(res.body.status).toBe('active');
    });
    it('blocks HR self-promotion to director', async () => {
        const hr = await createUser({ role: 'hr', password: 'Password123!' });
        const { token, user } = await loginAs(hr.email, 'Password123!');
        const res = await request(app)
            .patch(`/api/v1/users/${user.id}`)
            .set(authHeader(token))
            .send({ phoneNumber: '+919937112760', role: 'director' });
        expect(res.status).toBe(200);
        expect(res.body.role).toBe('hr');
    });
    it('allows directors to change role and status', async () => {
        const director = await createUser({ role: 'director', password: 'Password123!' });
        const victim = await createUser({ password: 'Password123!' });
        const { token } = await loginAs(director.email, 'Password123!');
        const res = await request(app)
            .patch(`/api/v1/users/${victim.id}`)
            .set(authHeader(token))
            .send({ phoneNumber: '+919937112760', role: 'hr' });
        expect(res.status).toBe(200);
        expect(res.body.role).toBe('hr');
    });
    it('rejects employee editors with 403', async () => {
        const user = await createUser({ password: 'Password123!' });
        const victim = await createUser({ password: 'Password123!' });
        const { token } = await loginAs(user.email, 'Password123!');
        const res = await request(app)
            .patch(`/api/v1/users/${victim.id}`)
            .set(authHeader(token))
            .send({ firstName: 'Hacked' });
        expect(res.status).toBe(403);
    });
});
describe('DELETE /api/v1/teams/:teamName validation', () => {
    it('rejects oversized team names with 400', async () => {
        const director = await createUser({ role: 'director', password: 'Password123!' });
        const { token } = await loginAs(director.email, 'Password123!');
        const res = await request(app).delete(`/api/v1/teams/${'x'.repeat(201)}`).set(authHeader(token));
        expect(res.status).toBe(400);
    });
});
