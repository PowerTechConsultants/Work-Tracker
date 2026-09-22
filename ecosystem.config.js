module.exports = {
  // Single-process production: Express (server.js) serves the API and the
  // static Vite build (web/out). There is no separate web process — the
  // frontend is static files, not a Next.js server.
  apps: [
    {
      name: 'employee-tracker-api',
      cwd: './server',
      script: process.env.NODE_ENV === 'production' ? 'dist/src/server.js' : 'src/server.ts',
      interpreter: process.env.NODE_ENV === 'production' ? 'node' : 'tsx',
      watch: process.env.NODE_ENV !== 'production',
      env: {
        NODE_ENV: 'development',
        PORT: 4001,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 4001,
      },
      max_restarts: 10,
      restart_delay: 5000,
    },
  ],
};
