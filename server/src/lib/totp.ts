import { generate, generateSecret, generateURI, verify } from 'otplib';

export interface TOTPOptions {
  secret: string;
  token: string;
  window?: number;
}

export async function verifyTOTP({ secret, token, window = 1 }: TOTPOptions): Promise<boolean> {
  if (!secret || !token) return false;
  try {
    const result = verify({ secret, token, algorithm: 'sha1', digits: 6, period: 30, epochTolerance: window } as any);
    return !!result;
  } catch (err) {
    console.error('[TOTP] Verification error:', err instanceof Error ? err.message : err);
    return false;
  }
}

export function createTOTPSecret(): string {
  return generateSecret({ length: 20 });
}

export function buildTOTPUri(issuer: string, label: string, secret: string): string {
  return generateURI({ issuer, label, secret, algorithm: 'sha1', digits: 6, period: 30 });
}

export function generateTOTPCode(secret: string): Promise<string> {
  return generate({ secret, algorithm: 'sha1', digits: 6, period: 30 });
}

