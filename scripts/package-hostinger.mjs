import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(projectRoot, 'dist');
const serverBuild = path.join(projectRoot, 'server', 'dist');
const serverSourceBuild = path.join(serverBuild, 'src');
const schemaFile = path.join(projectRoot, 'server', 'src', 'db', 'schema.mysql.sql');
const schemaSqliteFile = path.join(projectRoot, 'server', 'src', 'db', 'schema.sql');
const serverPackageFile = path.join(projectRoot, 'server', 'package.json');
const webBuild = path.join(projectRoot, 'web', 'out');

for (const requiredPath of [serverSourceBuild, schemaFile, schemaSqliteFile, serverPackageFile, webBuild]) {
  if (!fs.existsSync(requiredPath)) {
    throw new Error(`Missing build output: ${path.relative(projectRoot, requiredPath)}`);
  }
}

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });
for (const entry of fs.readdirSync(serverSourceBuild)) {
  fs.cpSync(path.join(serverSourceBuild, entry), path.join(outputDir, entry), { recursive: true });
}
const serverPackage = JSON.parse(fs.readFileSync(serverPackageFile, 'utf8'));
// Strip file: and native deps from dist/package.json.
// The runtime loads all modules from the repo root node_modules (where
// npm installs the vendored file: deps). Dist/package.json is only for
// Hostinger's metadata; listing better-sqlite3 here makes npm try to
// install it inside dist/ where vendor/ doesn't exist, falling back to
// the npm registry package that requires node-gyp (Python 3.6 fails).
const runtimeDeps = Object.fromEntries(
  Object.entries(serverPackage.dependencies || {}).filter(([k]) => k !== 'better-sqlite3' && k !== 'bcryptjs')
);
fs.writeFileSync(path.join(outputDir, 'package.json'), `${JSON.stringify({
  name: 'employee-work-tracker-runtime',
  version: serverPackage.version,
  private: true,
  type: 'module',
  scripts: { start: 'node server.js' },
  dependencies: runtimeDeps,
}, null, 2)}\n`);
fs.mkdirSync(path.join(outputDir, 'src', 'db'), { recursive: true });
fs.copyFileSync(schemaFile, path.join(outputDir, 'src', 'db', 'schema.mysql.sql'));
fs.copyFileSync(schemaSqliteFile, path.join(outputDir, 'src', 'db', 'schema.sql'));
fs.cpSync(webBuild, path.join(outputDir, 'web', 'out'), { recursive: true });

console.log('[DEPLOY] Packaged server and web output in dist/');
