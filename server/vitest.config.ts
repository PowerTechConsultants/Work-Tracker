import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['**/node_modules/**', '**/dist/**'],
    testTimeout: 60000,
    hookTimeout: 60000,
    globalSetup: ['./src/test/global-setup.ts'],
    setupFiles: ['./src/test/setup-env.ts'],
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
  },
});
