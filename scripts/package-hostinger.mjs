import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = path.join(projectRoot, 'dist');
const serverBuild = path.join(projectRoot, 'server', 'dist');
const serverSourceBuild = path.join(serverBuild, 'src');
const schemaFile = path.join(projectRoot, 'server', 'src', 'db', 'schema.mysql.sql');
const webBuild = path.join(projectRoot, 'web', 'out');

for (const requiredPath of [serverSourceBuild, schemaFile, webBuild]) {
  if (!fs.existsSync(requiredPath)) {
    throw new Error(`Missing build output: ${path.relative(projectRoot, requiredPath)}`);
  }
}

fs.rmSync(outputDir, { recursive: true, force: true });
fs.mkdirSync(outputDir, { recursive: true });
for (const entry of fs.readdirSync(serverSourceBuild)) {
  fs.cpSync(path.join(serverSourceBuild, entry), path.join(outputDir, entry), { recursive: true });
}
fs.writeFileSync(path.join(outputDir, 'package.json'), '{"type":"module"}\n');
fs.mkdirSync(path.join(outputDir, 'src', 'db'), { recursive: true });
fs.copyFileSync(schemaFile, path.join(outputDir, 'src', 'db', 'schema.mysql.sql'));
fs.cpSync(webBuild, path.join(outputDir, 'web', 'out'), { recursive: true });

console.log('[DEPLOY] Packaged server and web output in dist/');
