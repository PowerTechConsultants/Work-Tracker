import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

// Robust production entry point.
//
// Why this exists: PaaS deploy pipelines (Render "Uploading build", Hostinger
// "Output dist") have repeatedly served a runtime filesystem where the
// freshly built dist/ is absent or the process cwd is not the repo root.
// So instead of assuming ./dist/server.js relative to cwd, we:
//   1. resolve candidates against BOTH process.cwd() and this file's directory,
//   2. print diagnostics (cwd, dir listings, per-candidate FOUND/missing),
//   3. as a last resort run `npm run build` once, then retry,
//   4. exit(1) with actionable logs if everything fails.
// Explicit override: SERVER_BUNDLE=/abs/path/to/server.js

const here = path.dirname(fileURLToPath(import.meta.url));
const cwd = process.cwd();

function exists(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function candidates() {
  const list = [];
  const forced = process.env.SERVER_BUNDLE;
  if (forced) list.push(forced);
  for (const base of [cwd, here]) {
    list.push(
      path.join(base, 'dist', 'server.js'), // packaged output (packager + tracked dist/)
      path.join(base, 'server', 'dist', 'src', 'server.js'), // raw tsc output (no web assets)
      path.join(base, 'server', 'dist', 'server.js'),
      path.join(base, 'dist', 'src', 'server.js'),
    );
  }
  return [...new Set(list)];
}

function diagnose() {
  console.error(`[STARTUP] cwd=${cwd} wrapperDir=${here}`);
  for (const dir of [...new Set([cwd, here])]) {
    let entries;
    try {
      entries = fs.readdirSync(dir).slice(0, 40).join(', ');
    } catch (e) {
      entries = `<unreadable: ${e?.message ?? e}>`;
    }
    console.error(`[STARTUP] ls ${dir}: ${entries}`);
  }
  for (const p of candidates()) {
    console.error(`[STARTUP] ${exists(p) ? 'FOUND  ' : 'missing'} ${p}`);
  }
}

async function boot(target) {
  await import(pathToFileURL(target).href);
}

let target = candidates().find(exists);
if (!target) {
  console.error('[STARTUP] No server bundle found — attempting emergency build (npm run build)...');
  diagnose();
  try {
    execFileSync('npm', ['run', 'build'], { cwd: here, stdio: 'inherit', timeout: 10 * 60 * 1000 });
  } catch (e) {
    console.error('[STARTUP] Emergency build failed:', e?.message ?? e);
  }
  target = candidates().find(exists);
}

if (!target) {
  console.error('[STARTUP] Failed to start application: no server bundle found after build attempt.');
  console.error('[STARTUP] Ensure Build Command is "npm run build" (not "npm install") so dist/ is generated.');
  diagnose();
  process.exitCode = 1;
} else {
  try {
    await boot(target);
  } catch (e) {
    console.error('[STARTUP] Failed to start application:', e);
    diagnose();
    process.exitCode = 1;
  }
}
