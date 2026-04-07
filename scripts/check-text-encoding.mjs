import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd(), 'src');
const exts = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.md']);
const suspiciousPatterns = [
  /�/u,
  /Ã[\x80-\xBF]/u,
  /Â(?=[^\s])/u,
  /\bcl�nica\b/iu,
  /\brespons�vel\b/iu,
  /\bservi�o\b/iu,
  /\bop��es\b/iu,
];

const failures = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }
    if (!exts.has(path.extname(entry.name))) continue;
    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split(/\r?\n/);
    lines.forEach((line, index) => {
      if (suspiciousPatterns.some((pattern) => pattern.test(line))) {
        failures.push(`${path.relative(process.cwd(), fullPath)}:${index + 1}: ${line.trim()}`);
      }
    });
  }
}

walk(root);

if (failures.length) {
  console.error('Text encoding check failed. Suspicious lines found:');
  failures.forEach((line) => console.error(line));
  process.exit(1);
}

console.log('Text encoding check passed.');
