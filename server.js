import('./dist/server.js').catch((error) => {
  console.error('[STARTUP] Failed to start application:', error);
  process.exitCode = 1;
});
