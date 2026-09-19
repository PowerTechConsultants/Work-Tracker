import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: 'list',
  timeout: 60000,
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run dev -w server',
      url: 'http://localhost:4000/health',
      reuseExistingServer: true,
      timeout: 120000,
      cwd: '..',
      env: {
        DATABASE_URL: '',
        MYSQL_DATABASE: 'hr_test',
        NODE_ENV: 'test',
      },
    },
    {
      command: 'npm run dev -w web',
      url: 'http://localhost:3000/login',
      reuseExistingServer: true,
      timeout: 180000,
      cwd: '..',
    },
  ],
});
