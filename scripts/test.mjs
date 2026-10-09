import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { compressFile } = require('../src/compress.js');
const [file, level, target] = process.argv.slice(2);
const r = await compressFile(file, { level, targetMB: +target || 0 }, (p) => process.stderr.write(`\r${(p * 100).toFixed(0)}%`));
console.log('\n', r, r.after && (r.before / r.after).toFixed(2) + 'x');
