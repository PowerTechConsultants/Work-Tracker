import jwt from 'jsonwebtoken';
import { config } from './config.js';
export function signAccessToken(userId, email, role) {
    const payload = { sub: userId, email, role };
    const opts = { expiresIn: config.jwtAccessTtl };
    return jwt.sign(payload, config.jwtAccessSecret, opts);
}
export function verifyAccessToken(token) {
    const payload = jwt.verify(token, config.jwtAccessSecret, { algorithms: ['HS256'] });
    if (payload.step === '2fa')
        throw new Error('Invalid token type');
    return payload;
}
export function signRefreshToken(userId, tokenId) {
    const payload = { sub: userId, tokenId };
    const opts = { expiresIn: `${config.jwtRefreshTtlDays}d` };
    return jwt.sign(payload, config.jwtRefreshSecret, opts);
}
export function verifyRefreshToken(token) {
    return jwt.verify(token, config.jwtRefreshSecret, { algorithms: ['HS256'] });
}
export function signPendingAuthToken(userId, email) {
    const payload = { sub: userId, email, step: '2fa' };
    const opts = { expiresIn: '5m' };
    return jwt.sign(payload, config.jwtAccessSecret, opts);
}
export function verifyPendingAuthToken(token) {
    const payload = jwt.verify(token, config.jwtAccessSecret, { algorithms: ['HS256'] });
    if (payload.step !== '2fa')
        throw new Error('Unexpected token type');
    return payload;
}
