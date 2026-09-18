// Verify the generated PDF geometry: image placement, text sizes/positions, line rules.
import * as fs from 'fs';

const raw = fs.readFileSync(new URL('./sample-output/appointment_letter.pdf', import.meta.url));
const all = raw.toString('latin1');

const imgs = [...all.matchAll(/q ([\d.]+) 0 0 ([\d.]+) ([\d.]+) ([\d.]+) cm\s*\/(\w+) Do/g)];
console.log('image placements:', imgs.map((i) => `w=${i[1]} h=${i[2]} x=${i[3]} y=${i[4]}`).join(' | ') || 'NONE FOUND');

const texts = [...all.matchAll(/\/(\w+) ([\d.]+) Tf\s+([\s\S]{0,400}?)Tj/g)];
const seen = new Set<string>();
for (const t of texts) {
  const s = [...t[3].matchAll(/\((.*?)\)/g)].map((x) => x[1]).join('');
  const tm = t[3].match(/([\d.]+) ([\d.]+) Tm/);
  if (s && /Power Tech Consultants|Corporate Office|Regd\. Office|powerbazar|Email:|Phone:/.test(s)) {
    const key = s + t[2];
    if (seen.has(key)) continue;
    seen.add(key);
    console.log(`text: ${JSON.stringify(s.slice(0, 58))} | font ${t[1]} | size ${t[2]} | x ${tm ? tm[1] : '?'} y ${tm ? tm[2] : '?'}`);
  }
}

const lines = [...all.matchAll(/([\d.]+) w\s+(?:[\d.]+ [\d.]+ [\d.]+ rg\s+)?([\d.]+) ([\d.]+) m ([\d.]+) ([\d.]+) l S/g)];
for (const l of lines.slice(0, 10)) {
  console.log(`line w=${l[1]} from (${l[2]}, ${l[3]}) to (${l[4]}, ${l[5]})`);
}
