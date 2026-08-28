import { createApp } from '../src/app';
import http from 'http';
import { AddressInfo } from 'net';

let server: http.Server;
let baseURL: string;

export async function startTestServer(): Promise<string> {
  const app = createApp();
  return new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as AddressInfo;
      baseURL = `http://127.0.0.1:${addr.port}`;
      resolve(baseURL);
    });
  });
}

export async function stopTestServer(): Promise<void> {
  return new Promise((resolve) => {
    if (server) server.close(() => resolve());
    else resolve();
  });
}

export function getBaseURL(): string {
  return baseURL;
}
