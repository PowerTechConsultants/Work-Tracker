import { execSync } from 'child_process';
import path from 'path';

export function generateSelfSignedCert(certDir: string) {
  const keyPath = path.join(certDir, 'key.pem');
  const certPath = path.join(certDir, 'cert.pem');

  try {
    execSync(
      `openssl req -x509 -nodes -days 365 -newkey rsa:2048 -keyout "${keyPath}" -out "${certPath}" -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"`,
      { stdio: 'pipe', timeout: 10000 },
    );
    console.log('[CERT] Self-signed certificate generated in', certDir);
  } catch {
    throw new Error('OpenSSL is required to generate HTTPS certificates. Install OpenSSL or set ENABLE_HTTPS=false.');
  }
}
