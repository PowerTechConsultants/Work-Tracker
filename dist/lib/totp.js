import { generate, generateSecret, generateURI, verify } from 'otplib';
export async function verifyTOTP({ secret, token, window = 1 }) {
    if (!secret || !token)
        return false;
    try {
        const result = verify({ secret, token, algorithm: 'sha1', digits: 6, period: 30, window });
        return !!result;
    }
    catch (err) {
        console.error('[TOTP] Verification error:', err instanceof Error ? err.message : err);
        return false;
    }
}
export function createTOTPSecret() {
    return generateSecret({ length: 20 });
}
export function buildTOTPUri(issuer, label, secret) {
    return generateURI({ issuer, label, secret, algorithm: 'sha1', digits: 6, period: 30 });
}
export function generateTOTPCode(secret) {
    return generate({ secret, algorithm: 'sha1', digits: 6, period: 30 });
}
