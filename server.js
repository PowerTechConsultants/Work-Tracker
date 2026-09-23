const candidates = ['./dist/server.js', './server/dist/src/server.js', './server/dist/server.js', './dist/src/server.js'];
let started = false;
for (const p of candidates) {
  try {
    await import(p);
    started = true;
    break;
  } catch (e) {
    const msg = String(e?.message ?? e);
    const code = String(e?.code ?? '');
    if (!msg.includes('Cannot find module') && !code.includes('MODULE_NOT_FOUND')) {
      console.error('[STARTUP] Failed to start application:', e);
      process.exitCode = 1;
      started = true;
      break;
    }
  }
}
if (!started) {
  console.error('[STARTUP] Failed to start application: Cannot find module dist/server.js (tried: ' + candidates.join(', ') + ')');
  console.error('[STARTUP] Ensure Build Command is "npm run build" (not "npm install") so dist/ is generated. Check Render Dashboard → Settings → Build Command.');
  process.exitCode = 1;
}
