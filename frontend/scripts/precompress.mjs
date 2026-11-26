// Post-build step: emit pre-compressed .gz and .br siblings for text assets
// so nginx can serve them with gzip_static/brotli_static instead of burning
// CPU on the small VPS. Brotli quality 11 is fine here: it only runs at build
// time on a developer machine, not per request.
import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { gzipSync, brotliCompressSync, constants as zlibConstants } from 'node:zlib';
import { join, extname } from 'node:path';

const DIST = new URL('../dist', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const COMPRESSIBLE = new Set(['.js', '.css', '.html', '.svg', '.json', '.txt']);
const MIN_BYTES = 1024;

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

let count = 0;
let savedGzip = 0;
let savedBrotli = 0;

for (const file of walk(DIST)) {
  const ext = extname(file);
  if (!COMPRESSIBLE.has(ext)) continue;
  const raw = readFileSync(file);
  if (raw.length < MIN_BYTES) continue;

  const gz = gzipSync(raw, { level: 9 });
  writeFileSync(file + '.gz', gz);
  savedGzip += raw.length - gz.length;

  const br = brotliCompressSync(raw, {
    params: { [zlibConstants.BROTLI_PARAM_QUALITY]: 11 },
  });
  writeFileSync(file + '.br', br);
  savedBrotli += raw.length - br.length;
  count += 1;
}

const fmt = (n) => `${(n / 1024).toFixed(0)}KB`;
console.log(`precompress: ${count} files, gzip saves ${fmt(savedGzip)}, brotli saves ${fmt(savedBrotli)}`);
