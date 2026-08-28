module.exports = {
  apps: [
    {
      name: 'employee-tracker-api',
      cwd: './server',
      script: process.env.NODE_ENV === 'production' ? 'dist/src/server.js' : 'src/server.ts',
      interpreter: process.env.NODE_ENV === 'production' ? 'node' : 'tsx',
      watch: process.env.NODE_ENV !== 'production',
      env: {
        NODE_ENV: 'development',
        PORT: 4000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 4000,
      },
      max_restarts: 10,
      restart_delay: 5000,
    },
    {
      name: 'employee-tracker-web',
      cwd: './web',
      script: 'node_modules/next/dist/bin/next',
      args: process.env.NODE_ENV === 'production' ? 'start -p 3000' : 'dev --port 3000',
      watch: process.env.NODE_ENV !== 'production',
      env: {
        NODE_ENV: 'development',
        API_URL: 'http://localhost:4000',
      },
      env_production: {
        NODE_ENV: 'production',
        API_URL: 'http://localhost:4000',
      },
      max_restarts: 10,
      restart_delay: 5000,
    },
  ],
};
